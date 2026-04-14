import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { CreateCrmCallLogInput } from 'src/engine/core-modules/crm-call-log/dtos/create-crm-call-log.input';
import { CrmCallLogAnalyticsDTO } from 'src/engine/core-modules/crm-call-log/dtos/crm-call-log-analytics.dto';
import { CrmCallLogQueryInput } from 'src/engine/core-modules/crm-call-log/dtos/crm-call-log-query.input';
import { CrmCallLogEntity } from 'src/engine/core-modules/crm-call-log/entities/crm-call-log.entity';
import { CrmCallOutcome } from 'src/engine/core-modules/crm-call-log/enums/crm-call-outcome.enum';

@Injectable()
export class CrmCallLogService {
  constructor(
    @InjectRepository(CrmCallLogEntity)
    private readonly crmCallLogRepository: Repository<CrmCallLogEntity>,
  ) {}

  public async createCallLog({
    workspaceId,
    workspaceMemberId,
    input,
  }: {
    workspaceId: string;
    workspaceMemberId: string;
    input: CreateCrmCallLogInput;
  }): Promise<CrmCallLogEntity> {
    const crmCallLog = this.crmCallLogRepository.create({
      workspaceId,
      workspaceMemberId,
      businessNipt: input.businessNipt ?? null,
      phoneNumber: input.phoneNumber ?? null,
      outcome: input.outcome,
      historyEventType: input.historyEventType,
      durationInSeconds: input.durationInSeconds ?? null,
      notes: input.notes ?? null,
      calledAt: input.calledAt,
    });

    return this.crmCallLogRepository.save(crmCallLog);
  }

  public async getCallLogs({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input?: CrmCallLogQueryInput;
  }): Promise<CrmCallLogEntity[]> {
    const queryBuilder = this.crmCallLogRepository
      .createQueryBuilder('crmCallLog')
      .where('crmCallLog.workspaceId = :workspaceId', { workspaceId });

    if (input?.workspaceMemberId) {
      queryBuilder.andWhere(
        'crmCallLog.workspaceMemberId = :workspaceMemberId',
        {
          workspaceMemberId: input.workspaceMemberId,
        },
      );
    }

    if (input?.businessNipt) {
      queryBuilder.andWhere('crmCallLog.businessNipt = :businessNipt', {
        businessNipt: input.businessNipt,
      });
    }

    if (input?.outcomes && input.outcomes.length > 0) {
      queryBuilder.andWhere('crmCallLog.outcome IN (:...outcomes)', {
        outcomes: input.outcomes,
      });
    }

    if (input?.historyEventTypes && input.historyEventTypes.length > 0) {
      queryBuilder.andWhere(
        'crmCallLog.historyEventType IN (:...historyEventTypes)',
        {
          historyEventTypes: input.historyEventTypes,
        },
      );
    }

    if (input?.fromCalledAt) {
      queryBuilder.andWhere('crmCallLog.calledAt >= :fromCalledAt', {
        fromCalledAt: input.fromCalledAt,
      });
    }

    if (input?.toCalledAt) {
      queryBuilder.andWhere('crmCallLog.calledAt <= :toCalledAt', {
        toCalledAt: input.toCalledAt,
      });
    }

    return queryBuilder
      .orderBy('crmCallLog.calledAt', 'DESC')
      .limit(input?.limit ?? 50)
      .offset(input?.offset ?? 0)
      .getMany();
  }

  public async getWorkspaceAnalytics({
    workspaceId,
    fromCalledAt,
    toCalledAt,
  }: {
    workspaceId: string;
    fromCalledAt?: Date;
    toCalledAt?: Date;
  }): Promise<CrmCallLogAnalyticsDTO> {
    const queryBuilder = this.crmCallLogRepository
      .createQueryBuilder('crmCallLog')
      .where('crmCallLog.workspaceId = :workspaceId', { workspaceId });

    if (fromCalledAt) {
      queryBuilder.andWhere('crmCallLog.calledAt >= :fromCalledAt', {
        fromCalledAt,
      });
    }

    if (toCalledAt) {
      queryBuilder.andWhere('crmCallLog.calledAt <= :toCalledAt', {
        toCalledAt,
      });
    }

    const aggregatedResult = await queryBuilder
      .select('COUNT(*)', 'totalCalls')
      .addSelect(
        `SUM(CASE WHEN crmCallLog.outcome = :answeredOutcome THEN 1 ELSE 0 END)`,
        'answeredCalls',
      )
      .addSelect(
        `SUM(CASE WHEN crmCallLog.outcome = :noAnswerOutcome THEN 1 ELSE 0 END)`,
        'noAnswerCalls',
      )
      .addSelect(
        `SUM(CASE WHEN crmCallLog.outcome = :busyOutcome THEN 1 ELSE 0 END)`,
        'busyCalls',
      )
      .addSelect(
        `SUM(CASE WHEN crmCallLog.outcome = :failedOutcome THEN 1 ELSE 0 END)`,
        'failedCalls',
      )
      .addSelect(
        `SUM(CASE WHEN crmCallLog.outcome = :canceledOutcome THEN 1 ELSE 0 END)`,
        'canceledCalls',
      )
      .addSelect(
        'AVG(crmCallLog.durationInSeconds)',
        'averageDurationInSeconds',
      )
      .setParameters({
        answeredOutcome: CrmCallOutcome.ANSWERED,
        noAnswerOutcome: CrmCallOutcome.NO_ANSWER,
        busyOutcome: CrmCallOutcome.BUSY,
        failedOutcome: CrmCallOutcome.FAILED,
        canceledOutcome: CrmCallOutcome.CANCELED,
      })
      .getRawOne<{
        totalCalls: string;
        answeredCalls: string;
        noAnswerCalls: string;
        busyCalls: string;
        failedCalls: string;
        canceledCalls: string;
        averageDurationInSeconds: string | null;
      }>();

    const averageDurationInSeconds = aggregatedResult?.averageDurationInSeconds;

    return {
      totalCalls: Number(aggregatedResult?.totalCalls ?? 0),
      answeredCalls: Number(aggregatedResult?.answeredCalls ?? 0),
      noAnswerCalls: Number(aggregatedResult?.noAnswerCalls ?? 0),
      busyCalls: Number(aggregatedResult?.busyCalls ?? 0),
      failedCalls: Number(aggregatedResult?.failedCalls ?? 0),
      canceledCalls: Number(aggregatedResult?.canceledCalls ?? 0),
      averageDurationInSeconds:
        averageDurationInSeconds == null
          ? null
          : Number(averageDurationInSeconds),
    };
  }
}
