import { type ObjectMetadataSeed } from 'src/engine/workspace-manager/dev-seeder/metadata/types/object-metadata-seed.type';

export const BIC_BUSINESS_OBJECT_SEED: ObjectMetadataSeed = {
  labelPlural: 'Businesses',
  labelSingular: 'Business',
  namePlural: 'businesses',
  nameSingular: 'business',
  icon: 'IconBuildingStore',
};

export const BIC_INTERACTION_OBJECT_SEED: ObjectMetadataSeed = {
  labelPlural: 'Interactions',
  labelSingular: 'Interaction',
  namePlural: 'interactions',
  nameSingular: 'interaction',
  icon: 'IconMessageCircle',
  // Interactions don't need an extra "name" field; we query and sort by date.
  skipNameField: true,
};

