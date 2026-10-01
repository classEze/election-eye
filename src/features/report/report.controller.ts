import { Controller, Get, Query } from '@nestjs/common';
import { ReportService } from './report.service';
import {
  AllTimeIncidentSubmissionStatsDto,
  SubmissionsAndIncidentsFilterDto,
  SubmissionsAndIncidentsResponseDto,
  SystemActorsSummaryDto,
} from './report.dto';
import { Allowed } from 'src/shared/decorators/allowed.decorator';
import { RoleCode } from '../role/role.enum';

@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.ASPIRANT,
    RoleCode.CLIENT_USER,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
  ])
  @Get('summary')
  async getSystemActorsSummary(): Promise<SystemActorsSummaryDto> {
    return this.reportService.getSystemActorsSummary();
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.ASPIRANT,
    RoleCode.CLIENT_USER,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
  ])
  @Get('activity')
  async getSubmissionsAndIncidents(
    @Query() query: SubmissionsAndIncidentsFilterDto,
  ): Promise<SubmissionsAndIncidentsResponseDto> {
    return this.reportService.getSubmissionsAndIncidents(query);
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.ASPIRANT,
    RoleCode.CLIENT_USER,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
  ])
  @Get('overview-stats')
  async getAllTimeIncidentSubmissionStats(): Promise<AllTimeIncidentSubmissionStatsDto> {
    return this.reportService.getAllTimeIncidentSubmissionStats();
  }
}
