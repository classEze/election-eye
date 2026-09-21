import {
  Controller,
  Get,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SystemConfigurationService } from './system-configuration.service';
import { UpdateSystemConfigurationDto } from './system-configuration.dto';
import { SystemConfiguration } from './system-configuration.entity';
import { Allowed } from '../../shared/decorators/allowed.decorator';
import { RoleCode } from '../role/role.enum';
import { GetUser } from '../../shared/decorators/get-user.decorator';
import { Admin } from '../admin/admin.entity';

@Controller('system-configuration')
export class SystemConfigurationController {
  constructor(
    private readonly systemConfigService: SystemConfigurationService,
  ) {}

  @Get()
  async getConfiguration(): Promise<SystemConfiguration> {
    return this.systemConfigService.getConfiguration();
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Patch()
  @HttpCode(HttpStatus.OK)
  async updateConfiguration(
    @Body() dto: UpdateSystemConfigurationDto,
    @GetUser() admin: Admin,
  ): Promise<SystemConfiguration> {
    return this.systemConfigService.updateConfiguration(dto, admin);
  }
}
