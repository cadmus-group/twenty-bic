import { gql } from '@apollo/client';

export const CRM_CALL_LOG_FRAGMENT = gql`
  fragment CrmCallLogFields on CrmCallLogDTO {
    id
    workspaceMemberId
    businessNipt
    phoneNumber
    outcome
    historyEventType
    durationInSeconds
    notes
    calledAt
    createdAt
    updatedAt
  }
`;
