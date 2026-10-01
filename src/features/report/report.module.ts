import { Module } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { StateModule } from '../state/state.module';
import { LgaModule } from '../lga/lga.module';
import { WardModule } from '../ward/ward.module';
import { PollingUnitModule } from '../polling-unit/polling-unit.module';
import { AspirantModule } from '../aspirant/aspirant.module';
import { UserModule } from '../user/user.module';
import { PoliticalPartyModule } from '../political-party/political-party.module';
import { ElectoralOfficeModule } from '../electoral-office/electoral-office.module';
import { AdminModule } from '../admin/admin.module';
import { ResultModule } from '../result/result.module';
import { IncidentModule } from '../incident/incident.module';

@Module({
  imports: [
    StateModule,
    LgaModule,
    WardModule,
    PollingUnitModule,
    AspirantModule,
    UserModule,
    PoliticalPartyModule,
    ElectoralOfficeModule,
    AdminModule,
    ResultModule,
    IncidentModule,
  ],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
