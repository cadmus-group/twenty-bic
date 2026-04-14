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
export class CrmCallLogQueryInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  businessNipt?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  workspaceMemberId?: string;

  @Field(() => [CrmCallOutcome], { nullable: true })
  @IsOptional()
  @IsEnum(CrmCallOutcome, { each: true })
  outcomes?: CrmCallOutcome[];

  @Field(() => [CrmCallHistoryEventType], { nullable: true })
  @IsOptional()
  @IsEnum(CrmCallHistoryEventType, { each: true })
  historyEventTypes?: CrmCallHistoryEventType[];

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  fromCalledAt?: Date;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  toCalledAt?: Date;

  @Field(() => Int, { nullable: true, defaultValue: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
