import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from 'src/features/role/role.entity';
import { FindOptionsWhere, Repository } from 'typeorm';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  find(type?: string, status?: boolean): Promise<Role[]> {
    const where: FindOptionsWhere<Role> = {};

    if (type !== undefined) {
      where.type = type;
    }

    if (status !== undefined) {
      where.status = status;
    }

    return this.roleRepository.find({ where });
  }
}
