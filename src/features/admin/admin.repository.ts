import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from './admin.entity';
import { CreateAdminDto, UpdateAdminDto } from './admin.dto';

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

  async findAll(): Promise<Admin[]> {
    return this.repo
      .createQueryBuilder('admin')
      .innerJoinAndSelect('admin.role', 'role')
      .select([
        'admin.id',
        'admin.firstName',
        'admin.lastName',
        'admin.emailAddress',
        'admin.isActive',
        'admin.isVerified',
        'role.id',
        'role.name',
        'role.code',
      ])
      .getMany();
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

  async findByIdWithRelations(id: number): Promise<Admin | null> {
    try {
      return await this.repo
        .createQueryBuilder('admin')
        .leftJoinAndSelect('admin.role', 'role')
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
          'role.id',
          'role.name',
          'role.code',
          'role.type',
          'role.description',
          'role.status',
        ])
        .getOne();
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
    await this.repo.update({ id }, updateAdminDto);
    return await this.findOneById(id);
  }
}
