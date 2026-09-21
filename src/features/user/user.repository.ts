import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/features/user/user.entity';
import { CreateUserDto } from './user.dto.ts';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async insertOne(user: CreateUserDto): Promise<User> {
    try {
      const newUser = this.repo.create({
        firstName: user.firstName,
        lastName: user.lastName,
        emailAddress: user.emailAddress,
        phoneNumber: user.phoneNumber,
        password: user.password,
        role: user.role,
        isActive: false,
      });

      await this.repo.save(newUser);

      // `findOneOrFail` will throw if not found
      return await this.repo.findOneOrFail({
        where: { emailAddress: user.emailAddress },
      });
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
        'user.isActive',
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
          'user.isActive',
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
        { password, forcePasswordReset: false, isVerified: true },
      );
    } catch (error) {
      console.error('Error updating and verifying password:', error);
      throw error;
    }
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
          'user.isActive',
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

  async findByIdWithRelations(id: number): Promise<User | null> {
    try {
      return await this.repo
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.role', 'role')
        .leftJoinAndSelect('user.aspirant', 'aspirant')
        .leftJoinAndSelect('user.assignedLga', 'assignedLga')
        .leftJoinAndSelect('user.assignedWard', 'assignedWard')
        .leftJoinAndSelect('user.assignedPu', 'assignedPu')
        .leftJoinAndSelect('user.onboardedByUser', 'onboardedByUser')
        .where('user.id = :id', { id })
        .select([
          'user.id',
          'user.firstName',
          'user.lastName',
          'user.emailAddress',
          'user.phoneNumber',
          'user.isActive',
          'user.isVerified',
          'user.forcePasswordReset',
          'user.loginCount',
          'user.lastLogin',
          'user.deviceImei',
          'user.fcmToken',
          'user.createdAt',
          'user.updatedAt',
          'role.id',
          'role.name',
          'role.code',
          'role.type',
          'role.description',
          'role.status',
          'aspirant.id',
          'aspirant.firstName',
          'aspirant.lastName',
          'assignedLga.id',
          'assignedLga.name',
          'assignedWard.id',
          'assignedWard.name',
          'assignedPu.id',
          'assignedPu.name',
          'onboardedByUser.id',
          'onboardedByUser.firstName',
          'onboardedByUser.lastName',
        ])
        .getOne();
    } catch (error) {
      console.error('Error finding user by id with relations:', error);
      return null;
    }
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
}
