import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from 'src/features/role/role.entity';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { CacheKeyPrefix, CacheTTL } from 'src/shared/constants/cache.constant';
import { RoleCode } from './role.enum';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getAllCachedRoles(): Promise<Role[]> {
    const cacheKey = CacheKeyPrefix.ROLES;
    const cached = await this.cacheManager.get<Role[]>(cacheKey);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return cached;
    }

    const roles = await this.roleRepository.find();
    await this.cacheManager.set(cacheKey, roles, CacheTTL.ONE_DAY);
    return roles;
  }

  async getRoleById(id: number): Promise<Role | null> {
    const roles = await this.getAllCachedRoles();
    return roles.find((r) => Number(r.id) === Number(id)) || null;
  }

  async getRoleByCode(code: RoleCode): Promise<Role | null> {
    const roles = await this.getAllCachedRoles();
    return roles.find((r) => r.code === code) || null;
  }

  async find(type?: string, status?: boolean): Promise<Role[]> {
    const roles = await this.getAllCachedRoles();
    return roles.filter((role) => {
      if (type !== undefined && role.type !== type) return false;
      if (status !== undefined && role.status !== status) return false;
      return true;
    });
  }
}
