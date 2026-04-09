import { Module } from '@nestjs/common';

import { ApplicationModule } from 'src/engine/core-modules/application/application.module';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { FieldMetadataModule } from 'src/engine/metadata-modules/field-metadata/field-metadata.module';
import { WorkspaceManyOrAllFlatEntityMapsCacheModule } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.module';
import { ObjectMetadataModule } from 'src/engine/metadata-modules/object-metadata/object-metadata.module';
import { WorkspaceDataSourceModule } from 'src/engine/workspace-datasource/workspace-datasource.module';
import { WorkspaceMigrationModule } from 'src/engine/workspace-manager/workspace-migration/workspace-migration.module';

import { BicProvisionBicWorkflowCommand } from './commands/provision-bic-workflow.command';
import { BicProvisioningService } from './services/bic-provisioning.service';

@Module({
  imports: [
    WorkspaceDataSourceModule,
    DataSourceModule,
    ObjectMetadataModule,
    FieldMetadataModule,
    WorkspaceManyOrAllFlatEntityMapsCacheModule,
    ApplicationModule,
    WorkspaceMigrationModule,
  ],
  providers: [BicProvisioningService, BicProvisionBicWorkflowCommand],
})
export class BicProvisioningModule {}

