import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CrmCallLogAnalyticsDTO {
  @Field(() => Int)
  totalCalls: number;

  @Field(() => Int)
  answeredCalls: number;

  @Field(() => Int)
  noAnswerCalls: number;

  @Field(() => Int)
  busyCalls: number;

  @Field(() => Int)
  failedCalls: number;

  @Field(() => Int)
  canceledCalls: number;

  @Field(() => Float, { nullable: true })
  averageDurationInSeconds: number | null;
}
