import { gql } from '@apollo/client';

export const GET_CRM_CALL_LOG_ANALYTICS = gql`
  query GetCrmCallLogAnalytics($input: CrmCallLogAnalyticsInput) {
    crmCallLogAnalytics(input: $input) {
      totalCalls
      answeredCalls
      noAnswerCalls
      busyCalls
      failedCalls
      canceledCalls
      averageDurationInSeconds
    }
  }
`;
