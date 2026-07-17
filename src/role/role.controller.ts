import { Controller, Get, Query } from '@nestjs/common';
import { RoleService } from './role.service';
import { Role } from 'src/entities/role.entity';
import { GetRoleDTO } from './role.dto';

@Controller('role')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  async findRoles(@Query() query: GetRoleDTO): Promise<Role[]> {
    console.log(query.status);
    return await this.roleService.find(query.type, query.status);
  }
}
