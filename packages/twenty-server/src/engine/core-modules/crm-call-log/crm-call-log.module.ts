import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PermissionsModule } from 'src/engine/metadata-modules/permissions/permissions.module';

import { CrmCallLogEntity } from './entities/crm-call-log.entity';
import { CrmCallLogResolver } from './resolvers/crm-call-log.resolver';
import { CrmCallLogService } from './services/crm-call-log.service';

@Module({
  imports: [TypeOrmModule.forFeature([CrmCallLogEntity]), PermissionsModule],
  providers: [CrmCallLogResolver, CrmCallLogService],
  exports: [CrmCallLogService],
})
export class CrmCallLogModule {}
