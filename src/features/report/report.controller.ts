import { Controller, Get } from '@nestjs/common';
import { ReportService } from './report.service';
import { SystemActorsSummaryDto } from './report.dto';
import { Allowed } from 'src/shared/decorators/allowed.decorator';
import { RoleCode } from '../role/role.enum';

@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_ADMIN,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
    RoleCode.ASPIRANT,
  ])
  @Get('summary')
  async getSystemActorsSummary(): Promise<SystemActorsSummaryDto> {
    return this.reportService.getSystemActorsSummary();
  }
}
