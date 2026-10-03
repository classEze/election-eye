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
} from './incident.dto';
import { Allowed } from '../../shared/decorators/allowed.decorator';
import { RoleCode } from '../role/role.enum';
import { GetUser } from '../../shared/decorators/get-user.decorator';
import { User } from '../user/user.entity';
import { SubmissionWindowGuard } from '../../shared/guards/submission-window.guard';
import { Incident } from './incident.entity';

@Controller('incidents')
export class IncidentController {
  constructor(private readonly incidentService: IncidentService) {}

  @Get('categories')
  async getCategories() {
    return this.incidentService.getCategories();
  }

  @UseGuards(SubmissionWindowGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async reportIncident(
    @Body() dto: CreateIncidentDto,
    @GetUser() user: User,
  ): Promise<Incident> {
    return this.incidentService.createIncident(dto, user);
  }

  @UseGuards(SubmissionWindowGuard)
  @Post('media-upload-urls')
  @HttpCode(HttpStatus.OK)
  async getMediaUploadUrls(
    @Query('requestPhotoCount') requestPhotoCount = '0',
    @Query('requestVideoCount') requestVideoCount = '0',
    @Query('photoContentType') photoContentType?: string,
    @Query('videoContentType') videoContentType?: string,
  ) {
    return this.incidentService.getMediaUploadUrls(
      parseInt(requestPhotoCount, 10),
      parseInt(requestVideoCount, 10),
      photoContentType,
      videoContentType,
    );
  }

  @Get('map-clusters')
  async getMapClusters(@Query() query: IncidentMapClusterQueryDto) {
    return this.incidentService.findMapClusters(query);
  }

  @Get('electoral-office/:officeId')
  async getByElectoralOffice(
    @Param('officeId') officeId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.incidentService.findByElectoralOffice(+officeId, +page, +limit);
  }

  @Get()
  async findAll(@Query() query: IncidentFilterDto) {
    return this.incidentService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Incident> {
    return this.incidentService.findOne(+id);
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.ASPIRANT,
    RoleCode.CLIENT_USER,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
  ])
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateIncidentStatusDto,
  ): Promise<Incident> {
    return this.incidentService.updateStatus(+id, dto);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.incidentService.remove(+id);
  }
}
