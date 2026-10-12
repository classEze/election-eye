import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { IncidentService } from './incident.service';
import {
  CreateIncidentDto,
  IncidentFilterDto,
  IncidentMapClusterQueryDto,
  UpdateIncidentStatusDto,
  IncidentMediaUploadUrlsDto,
} from './incident.dto';
import { Allowed } from '../../shared/decorators/allowed.decorator';
import { RoleCode } from '../role/role.enum';
import { GetUser } from '../../shared/decorators/get-user.decorator';
import { User } from '../user/user.entity';
import { SubmissionWindowGuard } from '../../shared/guards/submission-window.guard';
import { Incident } from './incident.entity';
import { Audit } from '../../shared/decorators/audit.decorator';
import { resolveTenantAspirantId } from '../../shared/utils/tenant-context.util';

@Controller('incidents')
export class IncidentController {
  constructor(private readonly incidentService: IncidentService) {}

  @Get('categories')
  async getCategories() {
    return this.incidentService.getCategories();
  }

  @Audit({
    action: 'INCIDENT.REPORT',
    entityName: 'Incident',
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
  async reportIncident(
    @Body() dto: CreateIncidentDto,
    @GetUser() user: User,
  ): Promise<Incident> {
    return this.incidentService.createIncident(dto, user);
  }

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
    @Body() bodyDto: IncidentMediaUploadUrlsDto,
    @Query() queryDto: IncidentMediaUploadUrlsDto,
  ) {
    const mergedDto: IncidentMediaUploadUrlsDto = {
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
    return this.incidentService.getMediaUploadUrls(mergedDto);
  }

  @Get('map-clusters')
  async getMapClusters(
    @Query() query: IncidentMapClusterQueryDto,
    @GetUser() user: User,
  ) {
    const effectiveAspirantId = resolveTenantAspirantId(user, query.aspirantId);
    return this.incidentService.findMapClusters(query, effectiveAspirantId);
  }

  @Get('electoral-office/:officeId')
  async getByElectoralOffice(
    @Param('officeId') officeId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('aspirantId') queryAspirantId: string | undefined,
    @GetUser() user: User,
  ) {
    const effectiveAspirantId = resolveTenantAspirantId(
      user,
      queryAspirantId ? +queryAspirantId : undefined,
    );
    return this.incidentService.findByElectoralOffice(
      +officeId,
      +page,
      +limit,
      effectiveAspirantId,
    );
  }

  @Get()
  async findAll(@Query() query: IncidentFilterDto, @GetUser() user: User) {
    const effectiveAspirantId = resolveTenantAspirantId(user, query.aspirantId);
    return this.incidentService.findAll(query, effectiveAspirantId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @GetUser() user: User,
  ): Promise<Incident> {
    return this.incidentService.findOne(+id, user);
  }

  @Audit({
    action: 'INCIDENT.UPDATE_STATUS',
    entityName: 'Incident',
    logFailures: true,
  })
  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.ASPIRANT,
    RoleCode.CLIENT_USER,
  ])
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateIncidentStatusDto,
    @GetUser() user: User,
  ): Promise<Incident> {
    return this.incidentService.updateStatus(+id, dto, user);
  }

  @Audit({
    action: 'INCIDENT.DELETE',
    entityName: 'Incident',
    logFailures: true,
  })
  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.ASPIRANT,
    RoleCode.CLIENT_USER,
  ])
  @Delete(':id')
  async remove(@Param('id') id: string, @GetUser() user: User) {
    return this.incidentService.remove(+id, user);
  }
}
