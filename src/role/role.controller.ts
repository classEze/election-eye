import { Controller, Get } from '@nestjs/common';
import { RoleService } from './role.service';
import { ConfigService } from '@nestjs/config';

@Controller('role')
export class RoleController {
  constructor(private readonly roleService: RoleService, private readonly configService: ConfigService) {}

  @Get()
  findAll() {
    return this.configService.get('DATABASE_USER');
    // return this.roleService.findAll();
  }
}
