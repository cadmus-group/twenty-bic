import { FieldMetadataType, RelationType } from 'twenty-shared/types';

import { type FieldMetadataSeed } from 'src/engine/workspace-manager/dev-seeder/metadata/types/field-metadata-seed.type';

export const BIC_BUSINESS_CUSTOM_FIELD_SEEDS: FieldMetadataSeed[] = [
  {
    type: FieldMetadataType.TEXT,
    label: 'NIPT',
    name: 'nipt',
    // Nullable so quick-create (name-only) works; set NIPT on the record right after.
    isNullable: true,
    isUnique: true,
  },
  {
    type: FieldMetadataType.PHONES,
    label: 'Phone',
    name: 'phone',
    isNullable: true,
  },
  {
    type: FieldMetadataType.EMAILS,
    label: 'Email',
    name: 'email',
    isNullable: true,
  },
  {
    type: FieldMetadataType.SELECT,
    label: 'Sales stage',
    name: 'salesStage',
    isNullable: false,
    options: [
      { label: 'Registered', value: 'REGISTERED', position: 0, color: 'gray' },
      {
        label: 'Initial contact',
        value: 'INITIAL_CONTACT',
        position: 1,
        color: 'blue',
      },
      {
        label: 'Meeting scheduled',
        value: 'MEETING_SCHEDULED',
        position: 2,
        color: 'sky',
      },
      {
        label: 'Meeting done',
        value: 'MEETING_DONE',
        position: 3,
        color: 'purple',
      },
      {
        label: 'Decision pending',
        value: 'DECISION_PENDING',
        position: 4,
        color: 'yellow',
      },
      { label: 'Won', value: 'WON', position: 5, color: 'green' },
      { label: 'Lost', value: 'LOST', position: 6, color: 'red' },
    ],
  },
];

export const BIC_INTERACTION_CUSTOM_FIELD_SEEDS: FieldMetadataSeed[] = [
  {
    type: FieldMetadataType.DATE_TIME,
    label: 'Date',
    name: 'occurredAt',
    isNullable: false,
  },
  {
    type: FieldMetadataType.SELECT,
    label: 'Type',
    name: 'interactionType',
    isNullable: false,
    options: [
      {
        label: 'Initial contact',
        value: 'INITIAL_CONTACT',
        position: 0,
        color: 'blue',
      },
      {
        label: 'Meeting scheduling',
        value: 'MEETING_SCHEDULING',
        position: 1,
        color: 'sky',
      },
      {
        label: 'Meeting & presentation',
        value: 'MEETING_PRESENTATION',
        position: 2,
        color: 'purple',
      },
      {
        label: 'Package sale',
        value: 'PACKAGE_SALE',
        position: 3,
        color: 'green',
      },
    ],
  },
  {
    type: FieldMetadataType.TEXT,
    label: 'Agent',
    name: 'agent',
    isNullable: false,
  },
  {
    type: FieldMetadataType.SELECT,
    label: 'Status',
    name: 'interactionStatus',
    isNullable: true,
    options: [
      { label: 'No answer', value: 'NO_ANSWER', position: 0, color: 'gray' },
      {
        label: 'Not interested',
        value: 'NOT_INTERESTED',
        position: 1,
        color: 'red',
      },
      {
        label: 'Interested in meeting',
        value: 'INTERESTED_IN_MEETING',
        position: 2,
        color: 'green',
      },
    ],
  },
  {
    type: FieldMetadataType.SELECT,
    label: 'Meeting result',
    name: 'meetingResult',
    isNullable: true,
    options: [
      {
        label: 'Interested',
        value: 'INTERESTED',
        position: 0,
        color: 'green',
      },
      {
        label: 'Not interested',
        value: 'NOT_INTERESTED',
        position: 1,
        color: 'red',
      },
      {
        label: 'Decision pending',
        value: 'DECISION_PENDING',
        position: 2,
        color: 'yellow',
      },
    ],
  },
  {
    type: FieldMetadataType.SELECT,
    label: 'Package',
    name: 'soldPackage',
    isNullable: true,
    options: [
      { label: '€150', value: 'EUR_150', position: 0, color: 'green' },
      { label: '€300', value: 'EUR_300', position: 1, color: 'green' },
      { label: '€600', value: 'EUR_600', position: 2, color: 'green' },
    ],
  },
  {
    type: FieldMetadataType.TEXT,
    label: 'Comments',
    name: 'comments',
    isNullable: true,
  },
];

export const BIC_INTERACTION_BUSINESS_RELATION_FIELD_SEED: FieldMetadataSeed = {
  type: FieldMetadataType.RELATION,
  label: 'Business',
  name: 'business',
  icon: 'IconBuildingStore',
  isNullable: false,
  relationCreationPayload: {
    type: RelationType.MANY_TO_ONE,
    // targetObjectMetadataId is injected at runtime when provisioning.
    targetObjectMetadataId: '',
    targetFieldLabel: 'Interactions',
    targetFieldIcon: 'IconMessageCircle',
  },
};

