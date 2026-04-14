import { gql } from '@apollo/client';

import { CRM_CALL_LOG_FRAGMENT } from '../fragments/crmCallLogFragment';

export const GET_CRM_CALL_LOGS = gql`
  ${CRM_CALL_LOG_FRAGMENT}
  query GetCrmCallLogs($input: CrmCallLogQueryInput) {
    crmCallLogs(input: $input) {
      ...CrmCallLogFields
    }
  }
`;
