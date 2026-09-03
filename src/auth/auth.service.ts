import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { addHours } from 'date-fns';
import { randomBytes } from 'crypto';
import { PasswordResets } from 'src/entities/password-resets.entity';
import PasswordHelper from 'src/helpers/password.helper';
import { NotificationService } from 'src/notification/notification.service';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { UserRepository } from 'src/user/user.repository';
import { Repository } from 'typeorm';
import { ResetPasswordDto } from './auth.dto';

@Injectable()
export class AuthService {
  passwordHelper = new PasswordHelper();

  constructor(
    private readonly userRepo: UserRepository,
    private jwtService: JwtService,
    private readonly notify: NotificationService,

    @InjectRepository(PasswordResets)
    private readonly passwordResetsRepo: Repository<PasswordResets>,
  ) {}

  async signIn(LoginUserObj: {
    email: string;
    password: string;
  }): Promise<CreateUserDto | object> {
    const validUser = await this.userRepo.findOneByEmailAndPassword(
      LoginUserObj.email,
      LoginUserObj.password,
    );
    if (!validUser) {
      throw new UnauthorizedException('invalid credentials');
    }

    if (validUser.forcePasswordReset) {
      const passwordResetToken = randomBytes(32).toString('hex');

      const hashedToken = this.passwordHelper.hashbySHA256(passwordResetToken);

      const passwordResetRecord = this.passwordResetsRepo.create({
        userId: validUser.id,
        tokenHash: hashedToken,
        expiresAt: addHours(new Date(), 1),
      });

      await this.passwordResetsRepo.save(passwordResetRecord);

      return {
        forcePasswordReset: validUser.forcePasswordReset,
        passwordResetToken,
      };
    }

    const payload = {
      sub: validUser.id,
      role: validUser.role.id,
      code: validUser.role.code,
      email: validUser.emailAddress,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    await this.userRepo.updateLoginFields(validUser.id);
    return { ...validUser, accessToken };
  }

  async requestPasswordResetToken(email: string): Promise<object> {
    const validUser = await this.userRepo.findOneByEmail(email);

    if (!validUser) {
      return {
        statusCode: 200,
        message: 'Password Reset link sent if user email is valid',
      };
    }

    // if exist hash a token and save to password resets table
    const passwordResetToken = randomBytes(32).toString('hex');

    const hashedToken = this.passwordHelper.hashbySHA256(passwordResetToken);

    const passwordResetRecord = this.passwordResetsRepo.create({
      userId: validUser.id,
      tokenHash: hashedToken,
      expiresAt: addHours(new Date(), 1),
    });

    await this.passwordResetsRepo.save(passwordResetRecord);

    await this.notify.sendMailTrap({
      to: validUser.emailAddress,
      subject: 'Password Reset',
      message: `Dear ${validUser.firstName} ${validUser.lastName}, 
      You requested a password reset. Use the token below to reset your password.
      If you did not request a password reset, please ignore this email.
      token: ${passwordResetToken}
      The link expires in 1 hour.
      `,
      html: `
      <p>Password Reset</p>
      Dear ${validUser.firstName} ${validUser.lastName}, 
      You requested a password reset. Use the token below to reset your password.
      If you did not request a password reset, please ignore this email.
      token: ${passwordResetToken}
      The link expires in 1 hour.
      <a href="http://localhost:3000/reset-password?token=${passwordResetToken}">Reset Password</a>
      `,
    });

    return {
      statusCode: 200,
      message: 'Password Reset link sent if user email is valid',
    };
  }

  async requestPasswordReset(resetObj: ResetPasswordDto): Promise<object> {
    const tokenHash = this.passwordHelper.hashbySHA256(
      resetObj.passwordResetToken,
    );
    const passwordResetRecord = await this.passwordResetsRepo.findOne({
      where: { tokenHash },
    });

    if (!passwordResetRecord) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    // Check if the token is expired
    if (passwordResetRecord.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    // check if password meets requirements
    if (resetObj.password !== resetObj.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }
    if (
      !/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,40}$/.test(
        resetObj.password,
      )
    ) {
      throw new BadRequestException(
        'Password does not meet minimum requirements',
      );
    }

    // mark token as used
    await this.passwordResetsRepo.update(passwordResetRecord.id, {
      usedAt: new Date(),
    });

    // hash a new password and store
    const hashedPassword = await this.passwordHelper.hashUserPassword(
      resetObj.password,
    );
    await this.userRepo.updatePassword(
      passwordResetRecord.userId,
      hashedPassword,
    );

    return {
      statusCode: 200,
      message: 'Password reset was successful',
    };
  }
}
