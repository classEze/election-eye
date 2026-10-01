import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { User } from 'src/features/user/user.entity';
import { Role } from '../role/role.entity';
import { Lga } from '../lga/lga.entity';
import { Ward } from '../ward/ward.entity';
import { PollingUnit } from '../polling-unit/polling-unit.entity';
import { Aspirant } from '../aspirant/aspirant.entity';
import { Admin } from '../admin/admin.entity';
import {
  CreateUserDto,
  UpdateUserDto,
  UserQueryDto,
  AspirantUsersQueryDto,
} from './user.dto';
import { RoleCode } from '../role/role.enum';
import { UserStatus } from 'src/shared/enums/status.enum';

interface CoordinatorAgentCountSummaryRaw {
  lgaCoordinators: number;
  wardCoordinators: number;
  puAgents: number;
}

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async insertOne(user: CreateUserDto, hashedPassword?: string): Promise<User> {
    try {
      const newUser = this.repo.create({
        firstName: user.firstName,
        lastName: user.lastName,
        emailAddress: user.emailAddress,
        phoneNumber: user.phoneNumber,
        password: hashedPassword || user.password,
        role: { id: user.role_id } as Role,
        assignedLga: user.assignedLgaId
          ? { id: user.assignedLgaId }
          : undefined,
        assignedWard: user.assignedWardId
          ? { id: user.assignedWardId }
          : undefined,
        assignedPu: user.assignedPuId ? { id: user.assignedPuId } : undefined,
        aspirant: user.aspirantId
          ? ({ id: user.aspirantId } as Aspirant)
          : undefined,
        onboardedByUser: user.onboardedByUserId
          ? ({ id: user.onboardedByUserId } as User)
          : undefined,
        createdByAdmin: user.createdByAdminId
          ? ({ id: user.createdByAdminId } as Admin)
          : undefined,
        status: UserStatus.PENDING,
        deviceImei: user.deviceImei,
        fcmToken: user.fcmToken,
      });

      const saved = await this.repo.save(newUser);

      return (await this.findByIdWithRelations(saved.id)) as User;
    } catch (error) {
      console.error('Error inserting user:', error);
      throw error;
    }
  }

  async findOneByEmailAndPassword(
    email: string,
    password: string,
  ): Promise<User | null> {
    try {
      return await this.repo
        .createQueryBuilder('user')
        .innerJoinAndSelect('user.role', 'role')
        .where('user.emailAddress = :email', { email })
        .andWhere('user.password = :password', { password })
        .andWhere('user.isVerified = :isVerified', { isVerified: true })
        .select([
          'user.id',
          'user.emailAddress',
          'user.firstName',
          'user.lastName',
          'user.isVerified',
          'user.status',
          'role.id',
          'role.name',
          'role.code',
          'role.description',
        ])
        .getOne();
    } catch (error) {
      console.error('Error finding user by email and password:', error);
      return null;
    }
  }

  async findOneByEmail_(email: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .innerJoinAndSelect('user.role', 'role')
      .where('user.emailAddress = :email', { email })
      .select([
        'user.id',
        'user.firstName',
        'user.lastName',
        'user.emailAddress',
        'user.password',
        'user.status',
        'user.isVerified',
        'user.forcePasswordReset',
        'user.loginCount',
        'user.lastLogin',
        'role.id',
        'role.name',
        'role.code',
        'role.type',
      ])
      .getOne();
  }

  async findByIdWithPassword(id: number): Promise<User | null> {
    try {
      return await this.repo
        .createQueryBuilder('user')
        .where('user.id = :id', { id })
        .addSelect('user.password')
        .getOne();
    } catch (error) {
      console.error('Error finding user by id with password:', error);
      return null;
    }
  }

  async findOneByEmail(email: string): Promise<User | null> {
    try {
      return await this.repo
        .createQueryBuilder('user')
        .where('user.emailAddress = :email', { email })
        .select([
          'user.id',
          'user.firstName',
          'user.lastName',
          'user.emailAddress',
          'user.isVerified',
          'user.status',
        ])
        .getOne();
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  }

  async updatePassword(id: number, password: string): Promise<void> {
    try {
      await this.repo.update({ id }, { password, forcePasswordReset: false });
    } catch (error) {
      console.error('Error updating password:', error);
      throw error;
    }
  }

  async updatePasswordAndVerify(id: number, password: string): Promise<void> {
    try {
      await this.repo.update(
        { id },
        {
          password,
          forcePasswordReset: false,
          isVerified: true,
          status: UserStatus.ACTIVE,
        },
      );
    } catch (error) {
      console.error('Error updating and verifying password:', error);
      throw error;
    }
  }

  async findAll(queryDto?: UserQueryDto): Promise<{
    data: User[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const qb = this.repo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.assignedLga', 'assignedLga')
      .leftJoinAndSelect('user.assignedWard', 'assignedWard')
      .leftJoinAndSelect('user.assignedPu', 'assignedPu')
      .leftJoinAndSelect('user.aspirant', 'aspirant')
      .leftJoinAndSelect('user.aspirantAccount', 'aspirantAccount')
      .leftJoinAndSelect('user.onboardedByUser', 'onboardedByUser')
      .leftJoinAndSelect('user.createdByAdmin', 'createdByAdmin');

    if (queryDto?.search) {
      qb.andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.emailAddress ILIKE :search OR user.phoneNumber ILIKE :search)',
        { search: `%${queryDto.search}%` },
      );
    }

    if (queryDto?.roleId) {
      qb.andWhere('role.id = :roleId', { roleId: queryDto.roleId });
    }

    if (queryDto?.lgaId) {
      qb.andWhere('assignedLga.id = :lgaId', { lgaId: queryDto.lgaId });
    }

    if (queryDto?.wardId) {
      qb.andWhere('assignedWard.id = :wardId', { wardId: queryDto.wardId });
    }

    if (queryDto?.puId) {
      qb.andWhere('assignedPu.id = :puId', { puId: queryDto.puId });
    }

    if (queryDto?.status !== undefined) {
      qb.andWhere('user.status = :status', {
        status: queryDto.status,
      });
    }

    const page = queryDto?.page || 1;
    const limit = queryDto?.limit || 20;
    const skip = (page - 1) * limit;

    qb.orderBy('user.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findAspirantUsers(
    aspirantId: number,
    roleIdOrCode?: number | string,
    queryDto?: AspirantUsersQueryDto,
  ): Promise<{
    data: User[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const qb = this.repo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.aspirant', 'aspirant')
      .leftJoinAndSelect('user.assignedLga', 'assignedLga')
      .leftJoinAndSelect('user.assignedWard', 'assignedWard')
      .leftJoinAndSelect('user.assignedPu', 'assignedPu')
      .leftJoinAndSelect('user.onboardedByUser', 'onboardedByUser')
      .leftJoinAndSelect('user.createdByAdmin', 'createdByAdmin')
      .where('aspirant.id = :aspirantId', { aspirantId });

    const effectiveRole = roleIdOrCode ?? queryDto?.roleId ?? queryDto?.role;
    if (effectiveRole) {
      if (typeof effectiveRole === 'number' || !isNaN(Number(effectiveRole))) {
        qb.andWhere('role.id = :roleId', { roleId: Number(effectiveRole) });
      } else {
        qb.andWhere('role.code = :roleCode', { roleCode: effectiveRole });
      }
    } else {
      qb.andWhere('role.code != :aspirantRoleCode', {
        aspirantRoleCode: RoleCode.ASPIRANT,
      });
    }

    if (queryDto?.search) {
      qb.andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.emailAddress ILIKE :search OR user.phoneNumber ILIKE :search)',
        { search: `%${queryDto.search}%` },
      );
    }

    if (queryDto?.lgaId) {
      qb.andWhere('assignedLga.id = :lgaId', { lgaId: queryDto.lgaId });
    }

    if (queryDto?.wardId) {
      qb.andWhere('assignedWard.id = :wardId', { wardId: queryDto.wardId });
    }

    if (queryDto?.puId) {
      qb.andWhere('assignedPu.id = :puId', { puId: queryDto.puId });
    }

    if (queryDto?.status !== undefined) {
      qb.andWhere('user.status = :status', { status: queryDto.status });
    }

    const page = queryDto?.page || 1;
    const limit = queryDto?.limit || 20;
    const skip = (page - 1) * limit;

    qb.orderBy('user.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findById(id: number): Promise<User | null> {
    try {
      return await this.repo
        .createQueryBuilder('user')
        .where('user.id = :id', { id })
        .select([
          'user.id',
          'user.firstName',
          'user.lastName',
          'user.emailAddress',
          'user.phoneNumber',
          'user.status',
          'user.isVerified',
          'user.forcePasswordReset',
          'user.loginCount',
          'user.lastLogin',
          'user.deviceImei',
          'user.fcmToken',
          'user.createdAt',
          'user.updatedAt',
        ])
        .getOne();
    } catch (error) {
      console.error('Error finding user by id:', error);
      return null;
    }
  }

  async findByIdWithRelations(
    id: number,
    includeDeleted = false,
  ): Promise<User | null> {
    try {
      const qb = this.repo
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.role', 'role')
        .leftJoinAndSelect('user.aspirant', 'aspirant')
        .leftJoinAndSelect('user.aspirantAccount', 'aspirantAccount')
        .leftJoinAndSelect('user.assignedLga', 'assignedLga')
        .leftJoinAndSelect('user.assignedWard', 'assignedWard')
        .leftJoinAndSelect('user.assignedPu', 'assignedPu')
        .leftJoinAndSelect('user.onboardedByUser', 'onboardedByUser')
        .leftJoinAndSelect('user.createdByAdmin', 'createdByAdmin')
        .where('user.id = :id', { id });

      if (includeDeleted) {
        qb.withDeleted();
      }

      return await qb.getOne();
    } catch (error) {
      console.error('Error finding user by id with relations:', error);
      return null;
    }
  }

  async findOneById(id: number): Promise<User | null> {
    return this.findByIdWithRelations(id);
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User | null> {
    const updateData: QueryDeepPartialEntity<User> = {};

    if (updateUserDto.firstName !== undefined)
      updateData.firstName = updateUserDto.firstName;
    if (updateUserDto.lastName !== undefined)
      updateData.lastName = updateUserDto.lastName;
    if (updateUserDto.emailAddress !== undefined)
      updateData.emailAddress = updateUserDto.emailAddress;
    if (updateUserDto.phoneNumber !== undefined)
      updateData.phoneNumber = updateUserDto.phoneNumber;
    if (updateUserDto.password !== undefined)
      updateData.password = updateUserDto.password;
    if (updateUserDto.status !== undefined)
      updateData.status = updateUserDto.status;
    if (updateUserDto.deviceImei !== undefined)
      updateData.deviceImei = updateUserDto.deviceImei;
    if (updateUserDto.fcmToken !== undefined)
      updateData.fcmToken = updateUserDto.fcmToken;
    if (updateUserDto.role_id !== undefined)
      updateData.role = { id: updateUserDto.role_id };
    if (updateUserDto.assignedLgaId !== undefined) {
      updateData.assignedLga = updateUserDto.assignedLgaId
        ? { id: updateUserDto.assignedLgaId }
        : ({ id: null } as unknown as QueryDeepPartialEntity<Lga>);
    }
    if (updateUserDto.assignedWardId !== undefined) {
      updateData.assignedWard = updateUserDto.assignedWardId
        ? { id: updateUserDto.assignedWardId }
        : ({ id: null } as unknown as QueryDeepPartialEntity<Ward>);
    }
    if (updateUserDto.assignedPuId !== undefined) {
      updateData.assignedPu = updateUserDto.assignedPuId
        ? { id: updateUserDto.assignedPuId }
        : ({ id: null } as unknown as QueryDeepPartialEntity<PollingUnit>);
    }
    if (updateUserDto.aspirantId !== undefined) {
      updateData.aspirant = updateUserDto.aspirantId
        ? { id: updateUserDto.aspirantId }
        : ({ id: null } as unknown as QueryDeepPartialEntity<Aspirant>);
    }

    await this.repo.update({ id }, updateData);
    return this.findOneById(id);
  }

  async softDelete(id: number): Promise<boolean> {
    await this.repo.update({ id }, { status: UserStatus.INACTIVE });
    const result = await this.repo.softDelete(id);
    return (result.affected || 0) > 0;
  }

  async updateLoginFields(id: number): Promise<void> {
    try {
      await this.repo.update(
        { id },
        {
          forcePasswordReset: false,
          loginCount: () => 'login_count + 1',
          lastLogin: new Date(),
        },
      );
    } catch (error) {
      console.error('User update failed:', error);
    }
  }

  async countCoordinatorsAndAgents(): Promise<{
    lgaCoordinators: number;
    wardCoordinators: number;
    puAgents: number;
  }> {
    const raw = await this.repo
      .createQueryBuilder('user')
      .innerJoin('user.role', 'role')
      .select(
        'COUNT(user.id) FILTER (WHERE role.code = :lgaCoord)::int',
        'lgaCoordinators',
      )
      .addSelect(
        'COUNT(user.id) FILTER (WHERE role.code = :wardCoord)::int',
        'wardCoordinators',
      )
      .addSelect(
        'COUNT(user.id) FILTER (WHERE role.code = :puAgent)::int',
        'puAgents',
      )
      .setParameters({
        lgaCoord: RoleCode.LGA_COORDINATOR,
        wardCoord: RoleCode.WARD_COORDINATOR,
        puAgent: RoleCode.PU_AGENT,
      })
      .getRawOne<CoordinatorAgentCountSummaryRaw>();

    return {
      lgaCoordinators: Number(raw?.lgaCoordinators || 0),
      wardCoordinators: Number(raw?.wardCoordinators || 0),
      puAgents: Number(raw?.puAgents || 0),
    };
  }
}
