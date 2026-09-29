import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAdminDto, UpdateAdminDto, AdminQueryDto } from './admin.dto';
import { AdminRepository } from './admin.repository';
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
import { getAdminInfoCacheKey } from 'src/shared/constants/cache.constant';

@Injectable()
export class AdminService {
  private readonly passwordHelper = new PasswordHelper();

  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly adminRepo: AdminRepository,
    private readonly verification: EmailVerificationService,
    @InjectQueue(APP_QUEUES.mail) private readonly mailQueue: Queue,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async create(createAdminDto: CreateAdminDto) {
    const role = await this.roleRepository.findOne({
      where: { id: createAdminDto.role_id, status: true },
    });

    if (!role) {
      throw new NotFoundException('Active role not found');
    }

    if (
      ![
        RoleCode.SUPER_ADMIN,
        RoleCode.SYSTEM_ADMIN,
        RoleCode.CLIENT_ADMIN,
      ].includes(role.code as RoleCode)
    ) {
      throw new BadRequestException(
        'Invalid role for admin creation. Only SUPER_ADMIN, SYSTEM_ADMIN, and CLIENT_ADMIN roles are permitted.',
      );
    }

    const temporaryPassword = this.passwordHelper.generatePassword(18);
    const password =
      await this.passwordHelper.hashUserPassword(temporaryPassword);
    const result = await this.adminRepo.insertOne(
      createAdminDto,
      password,
      role,
    );

    // Single unified email containing verification link + temporary password login instructions
    await this.verification.issueForAdmin(result, temporaryPassword);

    return {
      id: result.id,
      firstName: result.firstName,
      lastName: result.lastName,
      emailAddress: result.emailAddress,
      phoneNumber: result.phoneNumber,
      role: result.role,
      status: result.status,
      isVerified: result.isVerified,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  async findAll(queryDto?: AdminQueryDto) {
    return this.adminRepo.findAll(queryDto);
  }

  async findOne(id: number) {
    const admin = await this.adminRepo.findOneById(id);
    if (!admin) {
      throw new NotFoundException(`Administrator with ID #${id} not found.`);
    }
    return admin;
  }

  async update(id: number, updateAdminDto: UpdateAdminDto) {
    await this.findOne(id);

    const updated = await this.adminRepo.update(id, updateAdminDto);

    // Invalidate cached admin session in Redis
    await this.cacheManager.del(getAdminInfoCacheKey(id));

    return updated;
  }

  async remove(id: number) {
    await this.findOne(id);

    const success = await this.adminRepo.softDelete(id);
    if (!success) {
      throw new NotFoundException(
        `Administrator with ID #${id} could not be deleted.`,
      );
    }

    // Invalidate cached admin session in Redis
    await this.cacheManager.del(getAdminInfoCacheKey(id));

    return {
      message: `Administrator with ID #${id} was successfully soft-deleted.`,
    };
  }
}
