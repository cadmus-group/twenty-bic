import { registerEnumType } from '@nestjs/graphql';

export enum CrmCallHistoryEventType {
  REGISTRATION = 'REGISTRATION',
  INITIAL_CONTACT = 'INITIAL_CONTACT',
  MEETING_SCHEDULING = 'MEETING_SCHEDULING',
  PRESENTATION = 'PRESENTATION',
  PACKAGE_SALE = 'PACKAGE_SALE',
  GENERAL_CALL = 'GENERAL_CALL',
}

registerEnumType(CrmCallHistoryEventType, {
  name: 'CrmCallHistoryEventType',
});
