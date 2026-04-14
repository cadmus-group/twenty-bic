import { Field, InputType, Int } from '@nestjs/graphql';

import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { CrmCallHistoryEventType } from '../enums/crm-call-history-event-type.enum';
import { CrmCallOutcome } from '../enums/crm-call-outcome.enum';

@InputType()
export class CreateCrmCallLogInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  businessNipt?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @Field(() => CrmCallOutcome)
  @IsEnum(CrmCallOutcome)
  outcome: CrmCallOutcome;

  @Field(() => CrmCallHistoryEventType)
  @IsEnum(CrmCallHistoryEventType)
  historyEventType: CrmCallHistoryEventType;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 60 * 60)
  durationInSeconds?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field(() => Date)
  @IsDate()
  calledAt: Date;
}
