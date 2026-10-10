import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Result } from './result.entity';
import { ResultDetail } from '../result-detail/result-detail.entity';
import { ResultController } from './result.controller';
import { ResultService } from './result.service';
import { ResultRepository } from './result.repository';
import { ResultExportService } from './result-export.service';
import { ResultAnomalyDetector } from './result-anomaly.detector';
import { StorageModule } from '../../shared/storage/storage.module';
import { SystemConfigurationModule } from '../system-configuration/system-configuration.module';

import { PollingUnit } from '../polling-unit/polling-unit.entity';
import { ElectoralOfficeModule } from '../electoral-office/electoral-office.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Result, ResultDetail, PollingUnit]),
    StorageModule,
    SystemConfigurationModule,
    ElectoralOfficeModule,
  ],
  controllers: [ResultController],
  providers: [
    ResultService,
    ResultRepository,
    ResultExportService,
    ResultAnomalyDetector,
  ],
  exports: [
    ResultService,
    ResultRepository,
    ResultExportService,
    ResultAnomalyDetector,
  ],
})
export class ResultModule {}
