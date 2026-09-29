import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import {
  CreateUserDto,
  UpdateUserDto,
  UserQueryDto,
  AspirantUsersQueryDto,
} from './user.dto';
import { UserRepository } from './user.repository';
import { RoleService } from '../role/role.service';
import { RoleCode } from '../role/role.enum';
import PasswordHelper from 'src/shared/helpers/password.helper';
import { EmailVerificationService } from 'src/shared/verification/email-verification.service';
import { APP_QUEUES } from '@/shared/constants/queue.constants';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { getUserInfoCacheKey } from 'src/shared/constants/cache.constant';

@Injectable()
export class UserService {
  private readonly passwordHelper = new PasswordHelper();

  constructor(
    private readonly roleService: RoleService,
    private readonly repo: UserRepository,
    private readonly verification: EmailVerificationService,
    @InjectQueue(APP_QUEUES.mail) private readonly mailQueue: Queue,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async create(userDto: CreateUserDto) {
    const role = await this.roleService.getRoleById(userDto.role_id);

    if (!role || !role.status) {
      throw new NotFoundException('Active role not found');
    }

    if (
      ![
        RoleCode.LGA_COORDINATOR,
        RoleCode.WARD_COORDINATOR,
        RoleCode.PU_AGENT,
      ].includes(role.code)
    ) {
      throw new BadRequestException(
        'Invalid role for user creation. Only LGA_COORDINATOR, WARD_COORDINATOR, and PU_AGENT roles are permitted for user accounts.',
      );
    }

    // Geographic sanitization according to hierarchical role assignment
    if (role.code === RoleCode.LGA_COORDINATOR) {
      userDto.assignedWardId = undefined;
      userDto.assignedPuId = undefined;
    } else if (role.code === RoleCode.WARD_COORDINATOR) {
      userDto.assignedPuId = undefined;
    }

    const randomPassword = this.passwordHelper.generatePassword(18);
    const hashedPassword =
      await this.passwordHelper.hashUserPassword(randomPassword);

    const result = await this.repo.insertOne(userDto, hashedPassword);

    // Single unified email containing verification link + temporary password login instructions
    await this.verification.issueForUser(result, randomPassword);

    const {
      password,
      loginCount,
      forcePasswordReset,
      lastLogin,
      ...filteredResult
    } = result;

    return filteredResult;
  }

  async findAll(queryDto?: UserQueryDto) {
    return this.repo.findAll(queryDto);
  }

  async findOne(id: number) {
    const user = await this.repo.findOneById(id);
    if (!user) {
      throw new NotFoundException(`User with ID #${id} not found.`);
    }
    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    await this.findOne(id);

    if (updateUserDto.role_id) {
      const role = await this.roleService.getRoleById(updateUserDto.role_id);
      if (!role || !role.status) {
        throw new NotFoundException('Active role not found');
      }
      if (
        ![
          RoleCode.LGA_COORDINATOR,
          RoleCode.WARD_COORDINATOR,
          RoleCode.PU_AGENT,
        ].includes(role.code)
      ) {
        throw new BadRequestException(
          'Invalid role. Only LGA_COORDINATOR, WARD_COORDINATOR, and PU_AGENT roles are permitted for user accounts.',
        );
      }
      if (role.code === RoleCode.LGA_COORDINATOR) {
        updateUserDto.assignedWardId = undefined;
        updateUserDto.assignedPuId = undefined;
      } else if (role.code === RoleCode.WARD_COORDINATOR) {
        updateUserDto.assignedPuId = undefined;
      }
    }

    const updated = await this.repo.update(id, updateUserDto);

    // Invalidate cached user session in Redis
    await this.cacheManager.del(getUserInfoCacheKey(id));

    return updated;
  }

  async remove(id: number) {
    await this.findOne(id);

    const success = await this.repo.softDelete(id);
    if (!success) {
      throw new NotFoundException(`User with ID #${id} could not be deleted.`);
    }

    // Invalidate cached user session in Redis
    await this.cacheManager.del(getUserInfoCacheKey(id));

    return {
      message: `User with ID #${id} was successfully soft-deleted.`,
    };
  }

  async findAspirantUsers(
    aspirantId: number,
    roleIdOrCode?: number | string,
    queryDto?: AspirantUsersQueryDto,
  ) {
    return this.repo.findAspirantUsers(aspirantId, roleIdOrCode, queryDto);
  }

  async findAspirantLgaCoordinators(
    aspirantId: number,
    queryDto?: AspirantUsersQueryDto,
  ) {
    return this.repo.findAspirantUsers(
      aspirantId,
      RoleCode.LGA_COORDINATOR,
      queryDto,
    );
  }

  async findAspirantWardCoordinators(
    aspirantId: number,
    queryDto?: AspirantUsersQueryDto,
  ) {
    return this.repo.findAspirantUsers(
      aspirantId,
      RoleCode.WARD_COORDINATOR,
      queryDto,
    );
  }

  async findAspirantPuAgents(
    aspirantId: number,
    queryDto?: AspirantUsersQueryDto,
  ) {
    return this.repo.findAspirantUsers(aspirantId, RoleCode.PU_AGENT, queryDto);
  }

  async findMyAspirantUsers(
    user: any,
    roleIdOrCode?: number | string,
    queryDto?: AspirantUsersQueryDto,
  ) {
    const aspirantId = user?.aspirantAccount?.id || user?.aspirant?.id;
    if (!aspirantId) {
      throw new BadRequestException(
        'No associated aspirant account found for the current authenticated user.',
      );
    }
    return this.repo.findAspirantUsers(aspirantId, roleIdOrCode, queryDto);
  }

  async findMyLgaCoordinators(user: any, queryDto?: AspirantUsersQueryDto) {
    return this.findMyAspirantUsers(user, RoleCode.LGA_COORDINATOR, queryDto);
  }

  async findMyWardCoordinators(user: any, queryDto?: AspirantUsersQueryDto) {
    return this.findMyAspirantUsers(user, RoleCode.WARD_COORDINATOR, queryDto);
  }

  async findMyPuAgents(user: any, queryDto?: AspirantUsersQueryDto) {
    return this.findMyAspirantUsers(user, RoleCode.PU_AGENT, queryDto);
  }
}
