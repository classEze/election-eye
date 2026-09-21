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
import { FileFieldsInterceptor } from '@nestjs/platform-express';
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
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'videos', maxCount: 2 },
      { name: 'pictures', maxCount: 5 },
    ]),
  )
  async reportIncident(
    @Body() dto: CreateIncidentDto,
    @GetUser() user: User,
    @UploadedFiles()
    files?: {
      videos?: Express.Multer.File[];
      pictures?: Express.Multer.File[];
    },
  ): Promise<Incident> {
    return this.incidentService.createIncident(dto, user, files);
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
    return this.incidentService.findByElectoralOffice(
      +officeId,
      +page,
      +limit,
    );
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
    RoleCode.CLIENT_ADMIN,
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
