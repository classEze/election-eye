import { Controller, Get, Query, Header } from '@nestjs/common';
import { ReportService } from './report.service';
import {
  AllTimeIncidentSubmissionStatsDto,
  SubmissionsAndIncidentsFilterDto,
  SubmissionsAndIncidentsResponseDto,
  SystemActorsSummaryDto,
  MySubmissionsFilterDto,
} from './report.dto';
import { GetUser } from '../../shared/decorators/get-user.decorator';
import { User } from '../user/user.entity';
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

  @Allowed([
    RoleCode.PU_AGENT,
    RoleCode.WARD_COORDINATOR,
    RoleCode.LGA_COORDINATOR,
  ])
  @Get('my-submissions')
  async getMySubmissions(
    @GetUser() user: User,
    @Query() query: MySubmissionsFilterDto,
  ) {
    return this.reportService.getMySubmissions(user.id, query);
  }

  @Allowed([
    RoleCode.PU_AGENT,
    RoleCode.WARD_COORDINATOR,
    RoleCode.LGA_COORDINATOR,
  ])
  @Get('my-submissions/export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="my_submissions.csv"')
  async exportMySubmissions(
    @GetUser() user: User,
    @Query() query: MySubmissionsFilterDto,
  ) {
    return this.reportService.exportMySubmissions(user.id, query);
  }
}
