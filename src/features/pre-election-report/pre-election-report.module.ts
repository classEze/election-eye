import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PreElectionReport } from './pre-election-report.entity';
import { PreElectionReportController } from './pre-election-report.controller';
import { PreElectionReportService } from './pre-election-report.service';
import { PreElectionReportRepository } from './pre-election-report.repository';
import { PollingUnit } from '../polling-unit/polling-unit.entity';
import { Result } from '../result/result.entity';
import { ElectoralOfficeModule } from '../electoral-office/electoral-office.module';
import { SystemConfigurationModule } from '../system-configuration/system-configuration.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PreElectionReport, PollingUnit, Result]),
    ElectoralOfficeModule,
    SystemConfigurationModule,
  ],
  controllers: [PreElectionReportController],
  providers: [PreElectionReportService, PreElectionReportRepository],
  exports: [PreElectionReportService, PreElectionReportRepository],
})
export class PreElectionReportModule {}
