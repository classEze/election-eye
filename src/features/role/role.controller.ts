import { Controller, Get, Query } from '@nestjs/common';
import { RoleService } from './role.service';
import { Role } from 'src/features/role/role.entity';
import { GetRoleDTO } from './role.dto';
import { Public } from 'src/shared/decorators/public.decorator';

@Controller('roles')
@Public()
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  async findRoles(@Query() query: GetRoleDTO): Promise<Role[]> {
    return await this.roleService.find(query.type, query.status);
  }
}
