import { gql } from '@apollo/client';

import { CRM_CALL_LOG_FRAGMENT } from '../fragments/crmCallLogFragment';

export const GET_CRM_MY_CALL_LOGS = gql`
  ${CRM_CALL_LOG_FRAGMENT}
  query GetCrmMyCallLogs($input: CrmCallLogQueryInput) {
    crmMyCallLogs(input: $input) {
      ...CrmCallLogFields
    }
  }
`;
