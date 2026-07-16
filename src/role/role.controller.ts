import { Controller, Get, Query } from '@nestjs/common';
import { RoleService } from './role.service';
import { Role } from 'src/entities/role.entity';

@Controller('role')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  async findRoles(
    @Query("type") type: string,
    @Query("status") status: string,
  ): Promise<Role[]> {
    return await this.roleService.find(type, status);
  }
}
