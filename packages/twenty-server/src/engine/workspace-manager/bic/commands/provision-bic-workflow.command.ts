import { Logger } from '@nestjs/common';

import { Command, CommandRunner, Option } from 'nest-commander';

import { WorkspaceMigrationBuilderException } from 'src/engine/workspace-manager/workspace-migration/exceptions/workspace-migration-builder-exception';

import { BicProvisioningService } from '../services/bic-provisioning.service';

type ProvisionBicWorkflowOptions = {
  workspaceId?: string;
};

@Command({
  name: 'workspace:provision:bic',
  description:
    'Provision BIC.al Business (NIPT) + Interaction (communication history) objects. Safe to re-run: adds any new fields.',
})
export class BicProvisionBicWorkflowCommand extends CommandRunner {
  private readonly logger = new Logger(BicProvisionBicWorkflowCommand.name);

  constructor(private readonly bicProvisioningService: BicProvisioningService) {
    super();
  }

  @Option({
    flags: '-w, --workspace-id <workspaceId>',
    description: 'Target workspace id (UUID)',
    required: true,
  })
  parseWorkspaceId(value: string): string {
    return value;
  }

  async run(
    _passedParams: string[],
    options: ProvisionBicWorkflowOptions,
  ): Promise<void> {
    if (!options.workspaceId) {
      throw new Error(
        'Missing workspace id. Example: npx nx run twenty-server:workspace-provision-bic -- --workspace-id=<uuid>',
      );
    }

    try {
      const { businessObject, interactionObject } =
        await this.bicProvisioningService.provisionWorkspace({
          workspaceId: options.workspaceId,
        });

      this.logger.log('BIC workflow provisioned successfully');
      this.logger.log(
        `Business object: ${businessObject.nameSingular} (${businessObject.id})`,
      );
      this.logger.log(
        `Interaction object: ${interactionObject.nameSingular} (${interactionObject.id})`,
      );
    } catch (error) {
      if (error instanceof WorkspaceMigrationBuilderException) {
        this.logger.error(
          JSON.stringify(error.failedWorkspaceMigrationBuildResult, null, 2),
        );
      }

      throw error;
    }
  }
}

