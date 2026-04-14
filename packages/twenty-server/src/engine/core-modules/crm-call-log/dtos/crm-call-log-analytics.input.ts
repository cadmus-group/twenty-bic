import { Field, InputType } from '@nestjs/graphql';

import { IsDate, IsOptional } from 'class-validator';

@InputType()
export class CrmCallLogAnalyticsInput {
  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  fromCalledAt?: Date;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  toCalledAt?: Date;
}
