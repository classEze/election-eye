import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateAdminDto, UpdateAdminDto, AdminQueryDto } from './admin.dto';
import { Allowed } from 'src/shared/decorators/allowed.decorator';
import { GetUser } from 'src/shared/decorators/get-user.decorator';
import { RoleCode } from '../role/role.enum';
import { Admin } from './admin.entity';

@Controller('admins')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createAdminDto: CreateAdminDto) {
    return this.adminService.create(createAdminDto);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Get()
  findAll(@Query() query: AdminQueryDto) {
    return this.adminService.findAll(query);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminService.findOne(+id);
  }

  @Allowed([RoleCode.SUPER_ADMIN])
  @Put(':id')
  updatePut(
    @Param('id') id: string,
    @Body() updateAdminDto: UpdateAdminDto,
    @GetUser() currentAdmin: Admin,
  ) {
    return this.adminService.update(+id, updateAdminDto, currentAdmin);
  }

  @Allowed([RoleCode.SUPER_ADMIN])
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAdminDto: UpdateAdminDto,
    @GetUser() currentAdmin: Admin,
  ) {
    return this.adminService.update(+id, updateAdminDto, currentAdmin);
  }

  @Allowed([RoleCode.SUPER_ADMIN])
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.adminService.remove(+id);
  }
}
