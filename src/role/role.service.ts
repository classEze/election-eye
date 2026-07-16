import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from 'src/entities/role.entity';
import { Repository } from 'typeorm';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  find(type: string, status: string): Promise<Role[]> {
    type = type.toUpperCase();
    const dbStatus = status.trim().toLowerCase() === 'true';

    return this.roleRepository.find({ where: { type, status: dbStatus } });
  }
}
