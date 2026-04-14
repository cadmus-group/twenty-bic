import { registerEnumType } from '@nestjs/graphql';

export enum CrmCallOutcome {
  ANSWERED = 'ANSWERED',
  NO_ANSWER = 'NO_ANSWER',
  BUSY = 'BUSY',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
}

registerEnumType(CrmCallOutcome, {
  name: 'CrmCallOutcome',
});
