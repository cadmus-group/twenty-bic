import { UseGuards, UsePipes } from '@nestjs/common';
import { Args, Mutation, Query } from '@nestjs/graphql';

import { PermissionFlagType } from 'twenty-shared/constants';

import { CoreResolver } from 'src/engine/api/graphql/graphql-config/decorators/core-resolver.decorator';
import { ResolverValidationPipe } from 'src/engine/core-modules/graphql/pipes/resolver-validation.pipe';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspaceMemberId } from 'src/engine/decorators/auth/auth-workspace-member-id.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { SettingsPermissionGuard } from 'src/engine/guards/settings-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

import { CreateCrmCallLogInput } from '../dtos/create-crm-call-log.input';
import { CrmCallLogAnalyticsDTO } from '../dtos/crm-call-log-analytics.dto';
import { CrmCallLogAnalyticsInput } from '../dtos/crm-call-log-analytics.input';
import { CrmCallLogQueryInput } from '../dtos/crm-call-log-query.input';
import { CrmCallLogDTO } from '../dtos/crm-call-log.dto';
import { CrmCallLogService } from '../services/crm-call-log.service';

@CoreResolver(() => CrmCallLogDTO)
@UseGuards(WorkspaceAuthGuard)
@UsePipes(ResolverValidationPipe)
export class CrmCallLogResolver {
  constructor(private readonly crmCallLogService: CrmCallLogService) {}

  @Mutation(() => CrmCallLogDTO)
  async createCrmCallLog(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string,
    @Args('input') input: CreateCrmCallLogInput,
  ): Promise<CrmCallLogDTO> {
    return this.crmCallLogService.createCallLog({
      workspaceId: workspace.id,
      workspaceMemberId,
      input,
    });
  }

  @Query(() => [CrmCallLogDTO])
  async crmCallLogs(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('input', { nullable: true }) input?: CrmCallLogQueryInput,
  ): Promise<CrmCallLogDTO[]> {
    return this.crmCallLogService.getCallLogs({
      workspaceId: workspace.id,
      input,
    });
  }

  @Query(() => [CrmCallLogDTO])
  async crmMyCallLogs(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthWorkspaceMemberId() workspaceMemberId: string,
    @Args('input', { nullable: true }) input?: CrmCallLogQueryInput,
  ): Promise<CrmCallLogDTO[]> {
    return this.crmCallLogService.getCallLogs({
      workspaceId: workspace.id,
      input: {
        ...input,
        workspaceMemberId,
      },
    });
  }

  @UseGuards(SettingsPermissionGuard(PermissionFlagType.WORKSPACE))
  @Query(() => CrmCallLogAnalyticsDTO)
  async crmCallLogAnalytics(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('input', { nullable: true }) input?: CrmCallLogAnalyticsInput,
  ): Promise<CrmCallLogAnalyticsDTO> {
    return this.crmCallLogService.getWorkspaceAnalytics({
      workspaceId: workspace.id,
      fromCalledAt: input?.fromCalledAt,
      toCalledAt: input?.toCalledAt,
    });
  }
}
