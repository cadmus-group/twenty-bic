import { Field, Float, ObjectType } from '@nestjs/graphql';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

import { CrmCallHistoryEventType } from '../enums/crm-call-history-event-type.enum';
import { CrmCallOutcome } from '../enums/crm-call-outcome.enum';

@ObjectType()
export class CrmCallLogDTO {
  @Field(() => UUIDScalarType)
  id: string;

  @Field(() => UUIDScalarType, { nullable: true })
  workspaceMemberId: string | null;

  @Field(() => String, { nullable: true })
  businessNipt: string | null;

  @Field(() => String, { nullable: true })
  phoneNumber: string | null;

  @Field(() => CrmCallOutcome)
  outcome: CrmCallOutcome;

  @Field(() => CrmCallHistoryEventType)
  historyEventType: CrmCallHistoryEventType;

  @Field(() => Float, { nullable: true })
  durationInSeconds: number | null;

  @Field(() => String, { nullable: true })
  notes: string | null;

  @Field(() => Date)
  calledAt: Date;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}
