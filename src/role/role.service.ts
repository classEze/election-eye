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

  find(type: string, status: boolean): Promise<Role[]> {
    console.log(type, status);
    return this.roleRepository.find({ where: { type, status } });
  }
}
