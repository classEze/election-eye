import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { PreElectionReportService } from './pre-election-report.service';
import {
  CreatePreElectionReportDto,
  PreElectionReportFilterDto,
  PaginatedPreElectionReportsResponse,
  PreElectionReportMediaUploadUrlsDto,
} from './pre-election-report.dto';
import { Allowed } from '../../shared/decorators/allowed.decorator';
import { RoleCode } from '../role/role.enum';
import { GetUser } from '../../shared/decorators/get-user.decorator';
import { User } from '../user/user.entity';
import { SubmissionWindowGuard } from '../../shared/guards/submission-window.guard';
import { PreElectionReport } from './pre-election-report.entity';
import { Audit } from '../../shared/decorators/audit.decorator';
import { resolveTenantAspirantId } from '../../shared/utils/tenant-context.util';

@Controller('pre-election-reports')
export class PreElectionReportController {
  constructor(
    private readonly preElectionReportService: PreElectionReportService,
  ) {}

  @Audit({ skip: true })
  @Allowed([
    RoleCode.PU_AGENT,
    RoleCode.WARD_COORDINATOR,
    RoleCode.LGA_COORDINATOR,
    RoleCode.ASPIRANT,
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_USER,
  ])
  @UseGuards(SubmissionWindowGuard)
  @Post('media-upload-urls')
  @HttpCode(HttpStatus.OK)
  async getMediaUploadUrls(
    @Body() bodyDto: PreElectionReportMediaUploadUrlsDto,
    @Query() queryDto: PreElectionReportMediaUploadUrlsDto,
  ) {
    const mergedDto: PreElectionReportMediaUploadUrlsDto = {
      requestPhotoCount:
        bodyDto?.requestPhotoCount !== undefined
          ? bodyDto.requestPhotoCount
          : (queryDto?.requestPhotoCount ? parseInt(queryDto.requestPhotoCount as any, 10) : 0),
      requestVideoCount:
        bodyDto?.requestVideoCount !== undefined
          ? bodyDto.requestVideoCount
          : (queryDto?.requestVideoCount ? parseInt(queryDto.requestVideoCount as any, 10) : 0),
      photoContentType: bodyDto?.photoContentType || queryDto?.photoContentType,
      videoContentType: bodyDto?.videoContentType || queryDto?.videoContentType,
    };
    return this.preElectionReportService.getMediaUploadUrls(mergedDto);
  }

  @Audit({
    action: 'PRE_ELECTION.SUBMIT',
    entityName: 'PreElectionReport',
    logFailures: true,
  })
  @Allowed([
    RoleCode.PU_AGENT,
    RoleCode.WARD_COORDINATOR,
    RoleCode.LGA_COORDINATOR,
  ])
  @UseGuards(SubmissionWindowGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async submitReport(
    @Body() dto: CreatePreElectionReportDto,
    @GetUser() user: User,
  ): Promise<PreElectionReport> {
    return this.preElectionReportService.submitPreElectionReport(dto, user);
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_USER,
    RoleCode.ASPIRANT,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
    RoleCode.PU_AGENT,
  ])
  @Get()
  async findAll(
    @Query() query: PreElectionReportFilterDto,
    @GetUser() user: User,
  ): Promise<PaginatedPreElectionReportsResponse> {
    const effectiveAspirantId = resolveTenantAspirantId(user, query.aspirantId);
    return this.preElectionReportService.findAll(query, effectiveAspirantId, user);
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_USER,
    RoleCode.ASPIRANT,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
    RoleCode.PU_AGENT,
  ])
  @Get('polling-unit/:puId')
  async findByPollingUnit(
    @Param('puId') puId: string,
    @Query('officeId') officeId: string,
    @Query('aspirantId') queryAspirantId: string,
    @GetUser() user: User,
  ): Promise<PreElectionReport | null> {
    const effectiveAspirantId = resolveTenantAspirantId(
      user,
      queryAspirantId ? +queryAspirantId : undefined,
    );
    return this.preElectionReportService.findByPollingUnitAndOffice(
      +puId,
      +officeId,
      effectiveAspirantId,
    );
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_USER,
    RoleCode.ASPIRANT,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
    RoleCode.PU_AGENT,
  ])
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @GetUser() user: User,
  ): Promise<PreElectionReport> {
    return this.preElectionReportService.findOne(+id, user);
  }
}
