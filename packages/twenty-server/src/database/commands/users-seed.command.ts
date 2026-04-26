import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Command, CommandRunner, Option } from 'nest-commander';
import { type APP_LOCALES, SOURCE_LOCALE } from 'twenty-shared/translations';
import { Repository } from 'typeorm';

import { hashPassword } from 'src/engine/core-modules/auth/auth.util';
import { UserWorkspaceService } from 'src/engine/core-modules/user-workspace/user-workspace.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

type SeedUser = {
  email: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  locale?: keyof typeof APP_LOCALES;
  isEmailVerified?: boolean;
  canAccessFullAdminPanel?: boolean;
  canImpersonate?: boolean;
};

type UsersSeedCommandOptions = {
  usersJson?: string;
  users?: string;
  workspaceId?: string;
  defaultPassword?: string;
  dryRun?: boolean;
};

@Command({
  name: 'users:seed',
  description:
    'Seed users from JSON or comma-separated emails. Intended for controlled one-off seeding (e.g. Railway).',
})
export class UsersSeedCommand extends CommandRunner {
  private readonly logger = new Logger(UsersSeedCommand.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    private readonly userWorkspaceService: UserWorkspaceService,
  ) {
    super();
  }

  @Option({
    flags: '--users-json <usersJson>',
    description:
      'JSON array of users. Example: [{"email":"a@x.com","firstName":"A","password":"StrongPassw0rd!"}]',
  })
  parseUsersJson(value: string): string {
    return value;
  }

  @Option({
    flags: '--users <users>',
    description: 'Comma-separated list of user emails',
  })
  parseUsers(value: string): string {
    return value;
  }

  @Option({
    flags: '--workspace-id <workspaceId>',
    description:
      'Optional workspace UUID to also attach each seeded user as a workspace member',
  })
  parseWorkspaceId(value: string): string {
    return value;
  }

  @Option({
    flags: '--default-password <defaultPassword>',
    description:
      'Fallback password when a user entry does not provide one (must match server password policy)',
  })
  parseDefaultPassword(value: string): string {
    return value;
  }

  @Option({
    flags: '--dry-run',
    description: 'Log intended actions without writing to the database',
  })
  parseDryRun(): boolean {
    return true;
  }

  async run(
    _passedParams: string[],
    options: UsersSeedCommandOptions,
  ): Promise<void> {
    const usersToSeed = this.parseUsersFromInput(options);

    if (usersToSeed.length === 0) {
      throw new Error(
        'No users provided. Use --users-json / --users or SEED_USERS_JSON / SEED_USERS.',
      );
    }

    const workspaceId = options.workspaceId ?? process.env.SEED_WORKSPACE_ID;
    const defaultPassword =
      options.defaultPassword ?? process.env.SEED_USERS_DEFAULT_PASSWORD;
    const dryRun = options.dryRun ?? false;

    const workspace = workspaceId
      ? await this.workspaceRepository.findOneBy({ id: workspaceId })
      : null;

    if (workspaceId && !workspace) {
      throw new Error(`Workspace ${workspaceId} was not found`);
    }

    this.logger.log(
      `Starting seed for ${usersToSeed.length} user(s)${workspaceId ? ` on workspace ${workspaceId}` : ''}${dryRun ? ' [dry-run]' : ''}`,
    );

    let createdCount = 0;
    let existingCount = 0;
    let updatedCount = 0;
    let attachedToWorkspaceCount = 0;

    for (const userToSeed of usersToSeed) {
      const email = userToSeed.email.trim().toLowerCase();

      if (!email) {
        this.logger.warn('Skipping empty email entry');
        continue;
      }

      const existingUser = await this.userRepository.findOneBy({ email });

      const user = existingUser
        ? await this.updateExistingUserIfNeeded({
            existingUser,
            userToSeed,
            dryRun,
          })
        : await this.createUserIfNeeded({
            userToSeed,
            email,
            defaultPassword,
            dryRun,
          });

      if (existingUser) {
        existingCount += 1;

        if (user.updated) {
          updatedCount += 1;
          this.logger.log(`Updated existing user ${email}`);
        } else {
          this.logger.log(`User ${email} already exists`);
        }
      } else if (user) {
        createdCount += 1;
        this.logger.log(`Created user ${email}`);
      }

      if (!workspace) {
        continue;
      }

      if (dryRun) {
        this.logger.log(
          `[dry-run] Would attach ${email} to workspace ${workspace.id}`,
        );
        attachedToWorkspaceCount += 1;
        continue;
      }

      await this.userWorkspaceService.addUserToWorkspaceIfUserNotInWorkspace(
        user.user,
        workspace,
      );

      attachedToWorkspaceCount += 1;
      this.logger.log(`Attached ${email} to workspace ${workspace.id}`);
    }

    this.logger.log(
      `User seed completed: ${createdCount} created, ${updatedCount} updated, ${existingCount} already existing, ${attachedToWorkspaceCount} attached to workspace`,
    );
  }

  private async createUserIfNeeded({
    userToSeed,
    email,
    defaultPassword,
    dryRun,
  }: {
    userToSeed: SeedUser;
    email: string;
    defaultPassword?: string;
    dryRun: boolean;
  }): Promise<{ user: UserEntity; updated: boolean }> {
    const resolvedPassword = userToSeed.password ?? defaultPassword;

    if (!resolvedPassword) {
      throw new Error(
        `No password found for ${email}. Provide password in user JSON or --default-password / SEED_USERS_DEFAULT_PASSWORD.`,
      );
    }

    if (dryRun) {
      this.logger.log(`[dry-run] Would create user ${email}`);

      return {
        user: this.userRepository.create({
          email,
          firstName: userToSeed.firstName ?? '',
          lastName: userToSeed.lastName ?? '',
        }),
        updated: false,
      };
    }

    const passwordHash = await hashPassword(resolvedPassword);

    const user = this.userRepository.create({
      email,
      firstName: userToSeed.firstName ?? '',
      lastName: userToSeed.lastName ?? '',
      passwordHash,
      locale: userToSeed.locale ?? SOURCE_LOCALE,
      isEmailVerified: userToSeed.isEmailVerified ?? true,
      canAccessFullAdminPanel: userToSeed.canAccessFullAdminPanel ?? false,
      canImpersonate: userToSeed.canImpersonate ?? false,
    });

    return { user: await this.userRepository.save(user), updated: false };
  }

  private async updateExistingUserIfNeeded({
    existingUser,
    userToSeed,
    dryRun,
  }: {
    existingUser: UserEntity;
    userToSeed: SeedUser;
    dryRun: boolean;
  }): Promise<{ user: UserEntity; updated: boolean }> {
    let hasChanges = false;

    if (
      userToSeed.firstName !== undefined &&
      userToSeed.firstName !== existingUser.firstName
    ) {
      existingUser.firstName = userToSeed.firstName;
      hasChanges = true;
    }

    if (
      userToSeed.lastName !== undefined &&
      userToSeed.lastName !== existingUser.lastName
    ) {
      existingUser.lastName = userToSeed.lastName;
      hasChanges = true;
    }

    if (
      userToSeed.locale !== undefined &&
      userToSeed.locale !== existingUser.locale
    ) {
      existingUser.locale = userToSeed.locale;
      hasChanges = true;
    }

    if (
      userToSeed.isEmailVerified !== undefined &&
      userToSeed.isEmailVerified !== existingUser.isEmailVerified
    ) {
      existingUser.isEmailVerified = userToSeed.isEmailVerified;
      hasChanges = true;
    }

    if (
      userToSeed.canAccessFullAdminPanel !== undefined &&
      userToSeed.canAccessFullAdminPanel !==
        existingUser.canAccessFullAdminPanel
    ) {
      existingUser.canAccessFullAdminPanel = userToSeed.canAccessFullAdminPanel;
      hasChanges = true;
    }

    if (
      userToSeed.canImpersonate !== undefined &&
      userToSeed.canImpersonate !== existingUser.canImpersonate
    ) {
      existingUser.canImpersonate = userToSeed.canImpersonate;
      hasChanges = true;
    }

    if (userToSeed.password !== undefined) {
      existingUser.passwordHash = await hashPassword(userToSeed.password);
      hasChanges = true;
    }

    if (!hasChanges) {
      return { user: existingUser, updated: false };
    }

    if (dryRun) {
      this.logger.log(
        `[dry-run] Would update existing user ${existingUser.email}`,
      );

      return { user: existingUser, updated: true };
    }

    return {
      user: await this.userRepository.save(existingUser),
      updated: true,
    };
  }

  private parseUsersFromInput(options: UsersSeedCommandOptions): SeedUser[] {
    const usersJson = options.usersJson ?? process.env.SEED_USERS_JSON;

    if (usersJson) {
      const parsed = JSON.parse(usersJson) as unknown;

      if (!Array.isArray(parsed)) {
        throw new Error('SEED_USERS_JSON / --users-json must be a JSON array');
      }

      return parsed
        .filter((entry): entry is SeedUser => {
          return (
            typeof entry === 'object' &&
            entry !== null &&
            'email' in entry &&
            typeof entry.email === 'string'
          );
        })
        .map((entry) => ({
          ...entry,
          email: entry.email.trim().toLowerCase(),
        }));
    }

    const users = options.users ?? process.env.SEED_USERS;

    if (!users) {
      return [];
    }

    return users
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0)
      .map((email) => ({ email }));
  }
}
