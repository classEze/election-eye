import { Injectable } from '@nestjs/common';
import { CreateUserDto, UpdateUserDto } from './user.dto.ts';
import { UserRepository } from './user.repository';
import PasswordHelper from 'src/shared/helpers/password.helper';
import { NotificationService } from 'src/shared/notification/notification.service';
import { EmailVerificationService } from 'src/shared/verification/email-verification.service';

@Injectable()
export class UserService {
  passwordHelper = new PasswordHelper();

  constructor(
    private readonly repo: UserRepository,
    private readonly notify: NotificationService,
    private readonly verification: EmailVerificationService,
  ) {}

  async create(user: CreateUserDto) {
    const randomPassword = this.passwordHelper.generatePassword(18);

    user.password = await this.passwordHelper.hashUserPassword(randomPassword);

    const result = await this.repo.insertOne(user);

    await this.verification.issueForUser(result);

    await this.notify.sendMailTrap({
      to: user.emailAddress,
      subject: 'Welcome to Innbase',
      message: `Dear ${user.firstName} ${user.lastName}, 
      Welcome to Innbase. Use the password below to login.
      password: ${randomPassword}
      `,
      html: `
      <p>Welcome to Innbase</p>
      Dear ${user.firstName} ${user.lastName}, 
      You were added to Innbase. Use the password below to login.
      password: ${randomPassword}
      <a href="http://localhost:3000/login">Login</a>
      `,
    });

    const {
      password,
      loginCount,
      forcePasswordReset,
      lastLogin,
      ...filteredResult
    } = result;
    return filteredResult;
  }

  findAll() {
    return `This action returns all user`;
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
