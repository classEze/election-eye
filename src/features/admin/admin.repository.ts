import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from './admin.entity';
import { CreateAdminDto, UpdateAdminDto, AdminQueryDto } from './admin.dto';
import { RoleCode } from '../role/role.enum';

@Injectable()
export class AdminRepository {
  constructor(
    @InjectRepository(Admin)
    private readonly repo: Repository<Admin>,
  ) {}

  async insertOne(
    admin: CreateAdminDto,
    password: string,
    role: Admin['role'],
  ): Promise<Admin> {
    const newAdmin = this.repo.create({
      firstName: admin.firstName,
      lastName: admin.lastName,
      emailAddress: admin.emailAddress,
      phoneNumber: admin.phoneNumber,
      password,
      role,
      isActive: false,
    });

    await this.repo.save(newAdmin);

    return this.repo.findOneOrFail({
      where: { emailAddress: admin.emailAddress },
      relations: { role: true },
    });
  }

  async findOneByEmail(email: string): Promise<Admin | null> {
    return this.repo
      .createQueryBuilder('admin')
      .innerJoinAndSelect('admin.role', 'role')
      .where('admin.emailAddress = :email', { email })
      .select([
        'admin.id',
        'admin.firstName',
        'admin.lastName',
        'admin.emailAddress',
        'admin.password',
        'admin.isActive',
        'admin.isVerified',
        'admin.forcePasswordReset',
        'admin.loginCount',
        'admin.lastLogin',
        'role.id',
        'role.name',
        'role.code',
        'role.type',
      ])
      .getOne();
  }

  async updateLoginFields(id: number): Promise<void> {
    await this.repo.update(
      { id },
      {
        forcePasswordReset: false,
        loginCount: () => 'login_count + 1',
        lastLogin: new Date(),
      },
    );
  }

  async updatePassword(id: number, password: string): Promise<void> {
    await this.repo.update({ id }, { password, forcePasswordReset: false });
  }

  async updatePasswordAndVerify(id: number, password: string): Promise<void> {
    await this.repo.update(
      { id },
      { password, forcePasswordReset: false, isVerified: true },
    );
  }

  async findAll(queryDto?: AdminQueryDto): Promise<{
    data: Admin[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const qb = this.repo
      .createQueryBuilder('admin')
      .leftJoinAndSelect('admin.role', 'role');

    if (queryDto?.search) {
      qb.andWhere(
        '(admin.firstName ILIKE :search OR admin.lastName ILIKE :search OR admin.emailAddress ILIKE :search OR admin.phoneNumber ILIKE :search)',
        { search: `%${queryDto.search}%` },
      );
    }

    if (queryDto?.roleId) {
      qb.andWhere('role.id = :roleId', { roleId: queryDto.roleId });
    }

    if (queryDto?.isActive !== undefined) {
      qb.andWhere('admin.isActive = :isActive', {
        isActive: queryDto.isActive,
      });
    }

    const page = queryDto?.page || 1;
    const limit = queryDto?.limit || 20;
    const skip = (page - 1) * limit;

    qb.orderBy('admin.createdAt', 'DESC').skip(skip).take(limit);

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

  async findById(id: number): Promise<Admin | null> {
    try {
      return await this.repo
        .createQueryBuilder('admin')
        .where('admin.id = :id', { id })
        .select([
          'admin.id',
          'admin.firstName',
          'admin.lastName',
          'admin.emailAddress',
          'admin.phoneNumber',
          'admin.isActive',
          'admin.isVerified',
          'admin.forcePasswordReset',
          'admin.loginCount',
          'admin.lastLogin',
          'admin.createdAt',
          'admin.updatedAt',
        ])
        .getOne();
    } catch (error) {
      console.error('Error finding admin by id:', error);
      return null;
    }
  }

  async findByIdWithRelations(
    id: number,
    includeDeleted = false,
  ): Promise<Admin | null> {
    try {
      const qb = this.repo
        .createQueryBuilder('admin')
        .leftJoinAndSelect('admin.role', 'role')
        .where('admin.id = :id', { id });

      if (includeDeleted) {
        qb.withDeleted();
      }

      return await qb.getOne();
    } catch (error) {
      console.error('Error finding admin by id with relations:', error);
      return null;
    }
  }

  async findOneById(id: number): Promise<Admin | null> {
    return this.findByIdWithRelations(id);
  }

  async update(
    id: number,
    updateAdminDto: UpdateAdminDto,
  ): Promise<Admin | null> {
    const updateData: Partial<Admin> = {};

    if (updateAdminDto.firstName !== undefined)
      updateData.firstName = updateAdminDto.firstName;
    if (updateAdminDto.lastName !== undefined)
      updateData.lastName = updateAdminDto.lastName;
    if (updateAdminDto.emailAddress !== undefined)
      updateData.emailAddress = updateAdminDto.emailAddress;
    if (updateAdminDto.phoneNumber !== undefined)
      updateData.phoneNumber = updateAdminDto.phoneNumber;
    if (updateAdminDto.isActive !== undefined)
      updateData.isActive = updateAdminDto.isActive;
    if (updateAdminDto.role_id !== undefined)
      updateData.role = { id: updateAdminDto.role_id } as any;

    await this.repo.update({ id }, updateData);
    return this.findOneById(id);
  }

  async softDelete(id: number): Promise<boolean> {
    await this.repo.update({ id }, { isActive: false });
    const result = await this.repo.softDelete(id);
    return (result.affected || 0) > 0;
  }

  async countAdminSummary(): Promise<{
    total: number;
    systemAdmins: number;
    superAdmins: number;
  }> {
    const raw = await this.repo
      .createQueryBuilder('admin')
      .innerJoin('admin.role', 'role')
      .select('role.code', 'roleCode')
      .addSelect('COUNT(admin.id)::int', 'count')
      .groupBy('role.code')
      .getRawMany();

    let total = 0;
    let systemAdmins = 0;
    let superAdmins = 0;

    for (const r of raw) {
      const cnt = Number(r.count || 0);
      total += cnt;
      if (r.roleCode === RoleCode.SYSTEM_ADMIN) {
        systemAdmins = cnt;
      } else if (r.roleCode === RoleCode.SUPER_ADMIN) {
        superAdmins = cnt;
      }
    }

    return {
      total,
      systemAdmins,
      superAdmins,
    };
  }
}
