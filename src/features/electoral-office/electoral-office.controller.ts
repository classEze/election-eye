import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ElectoralOfficeService,
  OfficeBoundaries,
  PaginatedResult,
} from './electoral-office.service';
import {
  CreateElectoralOfficeDto,
  UpdateElectoralOfficeDto,
  OfficeCategoryFilterQueryDto,
  PaginationQueryDto,
} from './electoral-office.dto';
import { Allowed } from '../../shared/decorators/allowed.decorator';
import { RoleCode } from '../role/role.enum';
import { ElectoralOffice, OfficeCategory } from './electoral-office.entity';
import { State } from '../state/state.entity';
import { Lga } from '../lga/lga.entity';
import { Ward } from '../ward/ward.entity';
import { PollingUnit } from '../polling-unit/polling-unit.entity';

@Controller('electoral-offices')
export class ElectoralOfficeController {
  constructor(
    private readonly electoralOfficeService: ElectoralOfficeService,
  ) {}

  @Get('categories')
  getCategories(): OfficeCategory[] {
    return this.electoralOfficeService.getCategories();
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createDto: CreateElectoralOfficeDto,
  ): Promise<ElectoralOffice> {
    return this.electoralOfficeService.create(createDto);
  }

  @Get()
  async findAll(): Promise<ElectoralOffice[]> {
    return this.electoralOfficeService.findAll();
  }

  @Get('category/:category')
  async findByCategory(
    @Param('category') category: OfficeCategory,
    @Query() filter: OfficeCategoryFilterQueryDto,
  ): Promise<ElectoralOffice[]> {
    return this.electoralOfficeService.findByCategory(category, filter.isActive);
  }

  @Get('aspirant/:aspirantId/boundaries')
  async getAspirantBoundaries(
    @Param('aspirantId') aspirantId: string,
  ): Promise<OfficeBoundaries> {
    return this.electoralOfficeService.getAspirantBoundaries(+aspirantId);
  }

  @Get(':id/boundaries')
  async getOfficeBoundaries(
    @Param('id') id: string,
  ): Promise<OfficeBoundaries> {
    return this.electoralOfficeService.getOfficeBoundaries(+id);
  }

  @Get(':id/states')
  async getOfficeStates(@Param('id') id: string): Promise<State[]> {
    return this.electoralOfficeService.getOfficeStates(+id);
  }

  @Get(':id/lgas')
  async getOfficeLgas(
    @Param('id') id: string,
    @Query() pagination: PaginationQueryDto,
  ): Promise<PaginatedResult<Lga>> {
    return this.electoralOfficeService.getOfficeLgas(+id, pagination);
  }

  @Get(':id/wards')
  async getOfficeWards(
    @Param('id') id: string,
    @Query() pagination: PaginationQueryDto,
  ): Promise<PaginatedResult<Ward>> {
    return this.electoralOfficeService.getOfficeWards(+id, pagination);
  }

  @Get(':id/polling-units')
  async getOfficePollingUnits(
    @Param('id') id: string,
    @Query() pagination: PaginationQueryDto,
  ): Promise<PaginatedResult<PollingUnit>> {
    return this.electoralOfficeService.getOfficePollingUnits(+id, pagination);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ElectoralOffice> {
    return this.electoralOfficeService.findOne(+id);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateElectoralOfficeDto,
  ): Promise<ElectoralOffice> {
    return this.electoralOfficeService.update(+id, updateDto);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ElectoralOffice> {
    return this.electoralOfficeService.remove(+id);
  }
}
