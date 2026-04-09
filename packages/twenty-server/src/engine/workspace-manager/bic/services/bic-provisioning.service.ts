import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { type DataSource } from 'typeorm';

import { isDefined } from 'twenty-shared/utils';
import { NavigationMenuItemType } from 'twenty-shared/types';

import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { DataSourceService } from 'src/engine/metadata-modules/data-source/data-source.service';
import { type UpdateFieldInput } from 'src/engine/metadata-modules/field-metadata/dtos/update-field.input';
import { FieldMetadataService } from 'src/engine/metadata-modules/field-metadata/services/field-metadata.service';
import { WorkspaceManyOrAllFlatEntityMapsCacheService } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatNavigationMenuItem } from 'src/engine/metadata-modules/flat-navigation-menu-item/types/flat-navigation-menu-item.type';
import { fromDeleteNavigationMenuItemInputToFlatNavigationMenuItemOrThrow } from 'src/engine/metadata-modules/flat-navigation-menu-item/utils/from-delete-navigation-menu-item-input-to-flat-navigation-menu-item-or-throw.util';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { ObjectMetadataService } from 'src/engine/metadata-modules/object-metadata/object-metadata.service';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { WorkspaceMigrationBuilderException } from 'src/engine/workspace-manager/workspace-migration/exceptions/workspace-migration-builder-exception';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

import {
  BIC_BUSINESS_CUSTOM_FIELD_SEEDS,
  BIC_INTERACTION_BUSINESS_RELATION_FIELD_SEED,
  BIC_INTERACTION_CUSTOM_FIELD_SEEDS,
} from '../constants/bic-custom-fields.constant';
import {
  BIC_BUSINESS_OBJECT_SEED,
  BIC_INTERACTION_OBJECT_SEED,
} from '../constants/bic-custom-objects.constant';
import { type FieldMetadataSeed } from 'src/engine/workspace-manager/dev-seeder/metadata/types/field-metadata-seed.type';

type ProvisionBicWorkflowResult = {
  businessObject: FlatObjectMetadata;
  interactionObject: FlatObjectMetadata;
};

@Injectable()
export class BicProvisioningService {
  constructor(
    private readonly workspaceDataSourceService: WorkspaceDataSourceService,
    private readonly dataSourceService: DataSourceService,
    private readonly objectMetadataService: ObjectMetadataService,
    private readonly fieldMetadataService: FieldMetadataService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
    private readonly flatEntityMapsCacheService: WorkspaceManyOrAllFlatEntityMapsCacheService,
    @InjectDataSource()
    private readonly coreDataSource: DataSource,
  ) {}

  public async provisionWorkspace({
    workspaceId,
  }: {
    workspaceId: string;
  }): Promise<ProvisionBicWorkflowResult> {
    const dataSourceMetadata = await this.getOrCreateDataSourceMetadata({
      workspaceId,
    });

    const businessObject = await this.getOrCreateObject({
      workspaceId,
      nameSingular: BIC_BUSINESS_OBJECT_SEED.nameSingular,
      create: () =>
        this.objectMetadataService.createOneObject({
          workspaceId,
          createObjectInput: {
            ...BIC_BUSINESS_OBJECT_SEED,
            dataSourceId: dataSourceMetadata.id,
          },
        }),
    });

    const interactionObject = await this.getOrCreateObject({
      workspaceId,
      nameSingular: BIC_INTERACTION_OBJECT_SEED.nameSingular,
      create: () =>
        this.objectMetadataService.createOneObject({
          workspaceId,
          createObjectInput: {
            ...BIC_INTERACTION_OBJECT_SEED,
            dataSourceId: dataSourceMetadata.id,
          },
        }),
    });

    await this.createMissingFields({
      workspaceId,
      objectMetadataId: businessObject.id,
      seeds: BIC_BUSINESS_CUSTOM_FIELD_SEEDS,
    });

    await this.createMissingFields({
      workspaceId,
      objectMetadataId: interactionObject.id,
      seeds: BIC_INTERACTION_CUSTOM_FIELD_SEEDS,
    });

    await this.ensureInteractionBusinessRelation({
      workspaceId,
      interactionObject,
      businessObject,
    });

    await this.applyBusinessCreationDefaults({
      workspaceId,
      businessObjectId: businessObject.id,
    });
    await this.ensureBusinessDatabaseColumnNullability(workspaceId);

    await this.removeUnnecessaryNavigationPages({
      workspaceId,
      businessObjectId: businessObject.id,
      interactionObjectId: interactionObject.id,
    });

    return { businessObject, interactionObject };
  }

  private async applyBusinessCreationDefaults({
    workspaceId,
    businessObjectId,
  }: {
    workspaceId: string;
    businessObjectId: string;
  }) {
    const { flatFieldMetadataMaps } = await this.getFreshFlatMaps(workspaceId);

    const businessFields = Object.values(flatFieldMetadataMaps.byUniversalIdentifier)
      .filter(isDefined)
      .filter((field) => field.objectMetadataId === businessObjectId);

    const niptField = businessFields.find((field) => field.name === 'nipt');
    const nameField = businessFields.find((field) => field.name === 'name');
    const phoneField = businessFields.find((field) => field.name === 'phone');
    const salesStageField = businessFields.find(
      (field) => field.name === 'salesStage',
    );

    await this.updateFieldIfNeeded({
      workspaceId,
      field: niptField,
      patch: { isNullable: true },
    });

    await this.updateFieldIfNeeded({
      workspaceId,
      field: nameField,
      patch: { isNullable: false },
    });

    await this.updateFieldIfNeeded({
      workspaceId,
      field: phoneField,
      patch: { isNullable: true },
    });

    await this.updateFieldIfNeeded({
      workspaceId,
      field: salesStageField,
      patch: {
        isNullable: false,
        defaultValue: "'REGISTERED'",
      },
    });
  }

  private async ensureBusinessDatabaseColumnNullability(
    workspaceId: string,
  ): Promise<void> {
    const schemaName = getWorkspaceSchemaName(workspaceId);
    const queryRunner = this.coreDataSource.createQueryRunner();

    try {
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."_business" ALTER COLUMN "nipt" DROP NOT NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."_business" ALTER COLUMN "phonePrimaryPhoneNumber" DROP NOT NULL`,
      );
    } catch {
      // Best effort: if the table/column does not exist yet, metadata-level updates still apply.
    } finally {
      await queryRunner.release();
    }
  }

  private async updateFieldIfNeeded({
    workspaceId,
    field,
    patch,
  }: {
    workspaceId: string;
    field: FlatFieldMetadata | undefined;
    patch: Partial<Omit<UpdateFieldInput, 'workspaceId'>>;
  }) {
    if (!isDefined(field)) {
      return;
    }

    const nextIsNullable =
      typeof patch.isNullable === 'boolean' ? patch.isNullable : field.isNullable;
    const nextDefaultValue =
      patch.defaultValue === undefined ? field.defaultValue : patch.defaultValue;

    const needsUpdate =
      field.isNullable !== nextIsNullable || field.defaultValue !== nextDefaultValue;

    if (!needsUpdate) {
      return;
    }

    await this.fieldMetadataService.updateOneField({
      workspaceId,
      updateFieldInput: {
        id: field.id,
        ...patch,
      },
    });
  }

  private async removeUnnecessaryNavigationPages({
    workspaceId,
    businessObjectId,
    interactionObjectId,
  }: {
    workspaceId: string;
    businessObjectId: string;
    interactionObjectId: string;
  }) {
    const { flatNavigationMenuItemMaps } =
      await this.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
        {
          workspaceId,
          flatMapsKeys: ['flatNavigationMenuItemMaps'],
        },
      );

    const allowedObjectIds = new Set([businessObjectId, interactionObjectId]);

    const navigationMenuItemIdsToDelete = Object.values(
      flatNavigationMenuItemMaps.byUniversalIdentifier,
    )
      .filter(isDefined)
      .filter(
        (navigationMenuItem) =>
          navigationMenuItem.type === NavigationMenuItemType.OBJECT &&
          isDefined(navigationMenuItem.targetObjectMetadataId) &&
          !allowedObjectIds.has(navigationMenuItem.targetObjectMetadataId),
      )
      .map((navigationMenuItem) => navigationMenuItem.id);

    const uniqueOrderedIds: string[] = [];
    const seenId = new Set<string>();

    for (const id of navigationMenuItemIdsToDelete) {
      if (!seenId.has(id)) {
        seenId.add(id);
        uniqueOrderedIds.push(id);
      }
    }

    if (uniqueOrderedIds.length === 0) {
      return;
    }

    const { workspaceCustomFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const flatEntitiesToDeleteOrdered: FlatNavigationMenuItem[] = [];
    const seenDeleteId = new Set<string>();

    for (const requestedId of uniqueOrderedIds) {
      const flatNavigationMenuItemRoot =
        fromDeleteNavigationMenuItemInputToFlatNavigationMenuItemOrThrow({
          flatNavigationMenuItemMaps,
          navigationMenuItemId: requestedId,
        });

      const flatEntitiesForRoot = [flatNavigationMenuItemRoot];

      if (flatNavigationMenuItemRoot.type === NavigationMenuItemType.FOLDER) {
        const userWorkspaceIdKey =
          flatNavigationMenuItemRoot.userWorkspaceId ?? 'null';
        const folderChildren =
          flatNavigationMenuItemMaps.byUserWorkspaceIdAndFolderId[
            userWorkspaceIdKey
          ]?.[requestedId] ?? [];

        flatEntitiesForRoot.unshift(...folderChildren);
      }

      for (const flatEntity of flatEntitiesForRoot) {
        if (!seenDeleteId.has(flatEntity.id)) {
          seenDeleteId.add(flatEntity.id);
          flatEntitiesToDeleteOrdered.push(flatEntity);
        }
      }
    }

    const validateAndBuildResult =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunWorkspaceMigration(
        {
          allFlatEntityOperationByMetadataName: {
            navigationMenuItem: {
              flatEntityToCreate: [],
              flatEntityToDelete: flatEntitiesToDeleteOrdered,
              flatEntityToUpdate: [],
            },
          },
          workspaceId,
          isSystemBuild: false,
          applicationUniversalIdentifier:
            workspaceCustomFlatApplication.universalIdentifier,
        },
      );

    if (validateAndBuildResult.status === 'fail') {
      throw new WorkspaceMigrationBuilderException(
        validateAndBuildResult,
        'Multiple validation errors occurred while deleting BIC navigation menu items',
      );
    }

    await this.flatEntityMapsCacheService.invalidateFlatEntityMaps({
      workspaceId,
      flatMapsKeys: ['flatNavigationMenuItemMaps'],
    });
  }

  private async getOrCreateDataSourceMetadata({
    workspaceId,
  }: {
    workspaceId: string;
  }) {
    const schemaExists =
      await this.workspaceDataSourceService.checkSchemaExists(workspaceId);

    const schemaName = schemaExists
      ? getWorkspaceSchemaName(workspaceId)
      : await this.workspaceDataSourceService.createWorkspaceDBSchema(workspaceId);

    return this.dataSourceService.createDataSourceMetadata(workspaceId, schemaName);
  }

  private async getOrCreateObject({
    workspaceId,
    nameSingular,
    create,
  }: {
    workspaceId: string;
    nameSingular: string;
    create: () => Promise<FlatObjectMetadata>;
  }): Promise<FlatObjectMetadata> {
    const existing = await this.objectMetadataService.findOneWithinWorkspace(
      workspaceId,
      {
        where: { nameSingular },
      },
    );

    if (isDefined(existing)) {
      const { flatObjectMetadataMaps } = await this.getFreshFlatMaps(workspaceId);
      const existingFlat =
        flatObjectMetadataMaps.byUniversalIdentifier[existing.universalIdentifier];

      if (isDefined(existingFlat)) {
        return existingFlat;
      }
    }

    return create();
  }

  private async createMissingFields({
    workspaceId,
    objectMetadataId,
    seeds,
  }: {
    workspaceId: string;
    objectMetadataId: string;
    seeds: FieldMetadataSeed[];
  }) {
    const { flatFieldMetadataMaps } = await this.getFreshFlatMaps(workspaceId);

    const existingFieldNames = new Set(
      Object.values(flatFieldMetadataMaps.byUniversalIdentifier)
        .filter(isDefined)
        .filter((field) => field.objectMetadataId === objectMetadataId)
        .map((field) => field.name),
    );

    const missing = seeds.filter((seed) => !existingFieldNames.has(seed.name));

    if (missing.length === 0) {
      return;
    }

    const createFieldInputs = missing.map((seed) => ({
      ...seed,
      objectMetadataId,
    }));

    await this.fieldMetadataService.createManyFields({
      workspaceId,
      createFieldInputs,
    });

    await this.flatEntityMapsCacheService.invalidateFlatEntityMaps({
      workspaceId,
      flatMapsKeys: ['flatFieldMetadataMaps'],
    });
  }

  private async ensureInteractionBusinessRelation({
    workspaceId,
    interactionObject,
    businessObject,
  }: {
    workspaceId: string;
    interactionObject: FlatObjectMetadata;
    businessObject: FlatObjectMetadata;
  }) {
    const { flatFieldMetadataMaps } = await this.getFreshFlatMaps(workspaceId);

    const interactionBusinessField = this.findFieldByName({
      flatFieldMetadataMaps,
      objectMetadataId: interactionObject.id,
      name: BIC_INTERACTION_BUSINESS_RELATION_FIELD_SEED.name,
    });

    const businessInteractionsField = this.findFieldByName({
      flatFieldMetadataMaps,
      objectMetadataId: businessObject.id,
      name: 'interactions',
    });

    if (isDefined(interactionBusinessField) && isDefined(businessInteractionsField)) {
      return;
    }

    if (isDefined(interactionBusinessField) || isDefined(businessInteractionsField)) {
      throw new Error(
        'BIC provisioning detected a partially-created Business<->Interaction relation. ' +
          'Please delete the incomplete relation fields and re-run provisioning.',
      );
    }

    const relationCreationPayload =
      BIC_INTERACTION_BUSINESS_RELATION_FIELD_SEED.relationCreationPayload;

    if (!isDefined(relationCreationPayload)) {
      throw new Error(
        'BIC business relation seed is missing relationCreationPayload',
      );
    }

    await this.fieldMetadataService.createManyFields({
      workspaceId,
      createFieldInputs: [
        {
          ...BIC_INTERACTION_BUSINESS_RELATION_FIELD_SEED,
          objectMetadataId: interactionObject.id,
          relationCreationPayload: {
            ...relationCreationPayload,
            targetObjectMetadataId: businessObject.id,
          },
        },
      ],
    });

    await this.flatEntityMapsCacheService.invalidateFlatEntityMaps({
      workspaceId,
      flatMapsKeys: ['flatFieldMetadataMaps'],
    });
  }

  private async getFreshFlatMaps(workspaceId: string): Promise<{
    flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
    flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  }> {
    await this.flatEntityMapsCacheService.invalidateFlatEntityMaps({
      workspaceId,
      flatMapsKeys: ['flatObjectMetadataMaps', 'flatFieldMetadataMaps'],
    });

    const { flatObjectMetadataMaps, flatFieldMetadataMaps } =
      await this.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
        {
          workspaceId,
          flatMapsKeys: ['flatObjectMetadataMaps', 'flatFieldMetadataMaps'],
        },
      );

    return { flatObjectMetadataMaps, flatFieldMetadataMaps };
  }

  private findFieldByName({
    flatFieldMetadataMaps,
    objectMetadataId,
    name,
  }: {
    flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
    objectMetadataId: string;
    name: string;
  }): FlatFieldMetadata | undefined {
    return Object.values(flatFieldMetadataMaps.byUniversalIdentifier)
      .filter(isDefined)
      .find(
        (field) =>
          field.objectMetadataId === objectMetadataId && field.name === name,
      );
  }
}

