import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

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
        password: user.password,
        role: user.role,
        status: false, // default to false until verified
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
        .select([
          'user.id',
          'user.emailAddress',
          'user.firstName',
          'user.lastName',
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

  async findOneByEmail(email: string): Promise<User | null> {
    try {
      return await this.repo
        .createQueryBuilder('user')
        .where('user.emailAddress = :email', { email })
        .select(['user.id'])
        .getOne();
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  }

  async updatePassword(id: string, password: string): Promise<void> {
    try {
      await this.repo.update({ id }, { password, forcePasswordReset: false });
    } catch (error) {
      console.error('Error updating password:', error);
    }
  }

  async updateLoginFields(id: string): Promise<void> {
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
