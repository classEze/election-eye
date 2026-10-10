import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Incident } from './incident.entity';
import { IncidentCategory } from '../../shared/entities/incident-category.entity';
import { IncidentController } from './incident.controller';
import { IncidentCategoryController } from './incident-category.controller';
import { IncidentService } from './incident.service';
import { IncidentRepository } from './incident.repository';
import { StorageModule } from '../../shared/storage/storage.module';
import { SystemConfigurationModule } from '../system-configuration/system-configuration.module';

import { PollingUnit } from '../polling-unit/polling-unit.entity';
import { Ward } from '../ward/ward.entity';
import { Lga } from '../lga/lga.entity';
import { ElectoralOfficeModule } from '../electoral-office/electoral-office.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Incident,
      IncidentCategory,
      PollingUnit,
      Ward,
      Lga,
    ]),
    StorageModule,
    SystemConfigurationModule,
    ElectoralOfficeModule,
  ],
  controllers: [IncidentController, IncidentCategoryController],
  providers: [IncidentService, IncidentRepository],
  exports: [IncidentService, IncidentRepository],
})
export class IncidentModule {}
