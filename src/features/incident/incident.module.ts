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

@Module({
  imports: [
    TypeOrmModule.forFeature([Incident, IncidentCategory]),
    StorageModule,
    SystemConfigurationModule,
  ],
  controllers: [IncidentController, IncidentCategoryController],
  providers: [IncidentService, IncidentRepository],
  exports: [IncidentService, IncidentRepository],
})
export class IncidentModule {}
