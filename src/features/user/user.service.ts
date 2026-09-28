import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto, UpdateUserDto, UserQueryDto } from './user.dto';
import { UserRepository } from './user.repository';
import { Role } from '../role/role.entity';
import { RoleCode } from '../role/role.enum';
import PasswordHelper from 'src/shared/helpers/password.helper';
import { EmailVerificationService } from 'src/shared/verification/email-verification.service';
import {
  APP_QUEUES,
} from '@/shared/constants/queue.constants';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { getUserInfoCacheKey } from 'src/shared/constants/cache.constant';

@Injectable()
export class UserService {
  private readonly passwordHelper = new PasswordHelper();

  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly repo: UserRepository,
    private readonly verification: EmailVerificationService,
    @InjectQueue(APP_QUEUES.mail) private readonly mailQueue: Queue,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async create(userDto: CreateUserDto) {
    const role = await this.roleRepository.findOne({
      where: { id: userDto.role_id, status: true },
    });

    if (!role) {
      throw new NotFoundException('Active role not found');
    }

    if (
      ![
        RoleCode.LGA_COORDINATOR,
        RoleCode.WARD_COORDINATOR,
        RoleCode.PU_AGENT,
      ].includes(role.code as RoleCode)
    ) {
      throw new BadRequestException(
        'Invalid role for user creation. Only LGA_COORDINATOR, WARD_COORDINATOR, and PU_AGENT roles are permitted for user accounts.',
      );
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
}
