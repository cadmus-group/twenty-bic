import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from 'typeorm';

import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

import { CrmCallHistoryEventType } from '../enums/crm-call-history-event-type.enum';
import { CrmCallOutcome } from '../enums/crm-call-outcome.enum';

@Entity({ name: 'crmCallLog', schema: 'core' })
@Index('IDX_CRM_CALL_LOG_WORKSPACE_ID_CALLED_AT', ['workspaceId', 'calledAt'])
@Index('IDX_CRM_CALL_LOG_WORKSPACE_ID_WORKSPACE_MEMBER_ID', [
  'workspaceId',
  'workspaceMemberId',
])
@Index('IDX_CRM_CALL_LOG_WORKSPACE_ID_BUSINESS_NIPT', ['workspaceId', 'businessNipt'])
export class CrmCallLogEntity extends WorkspaceRelatedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true, type: 'uuid' })
  workspaceMemberId: string | null;

  @ManyToOne(() => UserWorkspaceEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'workspaceMemberId' })
  workspaceMember: Relation<UserWorkspaceEntity> | null;

  @Column({ nullable: true, type: 'text' })
  businessNipt: string | null;

  @Column({ nullable: true, type: 'text' })
  phoneNumber: string | null;

  @Column({ type: 'enum', enum: CrmCallOutcome })
  outcome: CrmCallOutcome;

  @Column({ type: 'enum', enum: CrmCallHistoryEventType })
  historyEventType: CrmCallHistoryEventType;

  @Column({ nullable: true, type: 'integer' })
  durationInSeconds: number | null;

  @Column({ nullable: true, type: 'text' })
  notes: string | null;

  @Column({ type: 'timestamptz' })
  calledAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
