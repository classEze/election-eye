import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { addHours } from 'date-fns';
import { randomBytes } from 'node:crypto';
import PasswordHelper from 'src/shared/helpers/password.helper';
import { NotificationService } from 'src/shared/notification/notification.service';
import { CreateUserDto } from 'src/features/user/user.dto.ts';
import { User } from 'src/features/user/user.entity';
import { UserRepository } from 'src/features/user/user.repository';
import { IsNull, Repository } from 'typeorm';
import { ResendVerificationDto, ResetPasswordDto } from './auth.dto';
import { EmailVerificationService } from 'src/shared/verification/email-verification.service';
import { PasswordResets } from 'src/shared/entities/password-resets.entity';
import { AdminRepository } from 'src/features/admin/admin.repository';
import { AdminPasswordResets } from 'src/features/admin/admin-password-resets.entity';
import { Admin } from 'src/features/admin/admin.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import {
  CacheTTL,
  getUserInfoCacheKey,
  getAdminInfoCacheKey,
} from 'src/shared/constants/cache.constant';

@Injectable()
export class AuthService {
  private readonly passwordHelper = new PasswordHelper();

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly userRepo: UserRepository,
    private readonly jwtService: JwtService,
    private readonly notify: NotificationService,
    @InjectRepository(PasswordResets)
    private readonly passwordResetsRepo: Repository<PasswordResets>,
    @InjectRepository(AdminPasswordResets)
    private readonly adminPasswordResetsRepo: Repository<AdminPasswordResets>,
    private readonly verification: EmailVerificationService,
    private readonly adminRepo: AdminRepository,
    private readonly configService: ConfigService,
  ) {}

  async signIn(LoginUserObj: {
    emailAddress: string;
    password: string;
  }): Promise<CreateUserDto | object> {
    const validUser = await this.userRepo.findOneByEmail_(
      LoginUserObj.emailAddress,
    );

    const validPassword = validUser
      ? await this.passwordHelper.verifyUserPassword(
          LoginUserObj.password,
          validUser.password,
        )
      : false;

    if (!validUser || !validPassword) {
      throw new UnauthorizedException('invalid credentials');
    }

    if (!validUser.isVerified) {
      throw new UnauthorizedException('User email address is not verified');
    }

    if (!validUser.isActive) {
      throw new UnauthorizedException('User account is not active');
    }

    if (validUser.forcePasswordReset) {
      const passwordResetToken =
        await this.createUserPasswordResetToken(validUser);

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
      type: this.configService.get<string>('app.client') ?? 'client',
    };

    const accessToken = await this.jwtService.signAsync(payload);
    await this.userRepo.updateLoginFields(validUser.id);

    const userWithRelations =
      (await this.userRepo.findByIdWithRelations(validUser.id)) ?? validUser;

    const cacheKey = getUserInfoCacheKey(validUser.id);
    await this.cacheManager.set(cacheKey, userWithRelations, CacheTTL.ONE_DAY);

    return { ...userWithRelations, accessToken };
  }

  async adminSignIn(loginAdminObj: {
    emailAddress: string;
    password: string;
  }): Promise<object> {
    const admin = await this.adminRepo.findOneByEmail(
      loginAdminObj.emailAddress,
    );

    const validPassword = admin
      ? await this.passwordHelper.verifyUserPassword(
          loginAdminObj.password,
          admin.password,
        )
      : false;

    if (!admin || !validPassword) {
      throw new UnauthorizedException('invalid credentials');
    }

    if (!admin.isVerified) {
      throw new UnauthorizedException('User email address is not verified');
    }

    if (!admin.isActive) {
      throw new UnauthorizedException('User account is not active');
    }

    if (admin.forcePasswordReset) {
      const passwordResetToken =
        await this.createAdminPasswordResetToken(admin);
      return {
        forcePasswordReset: true,
        passwordResetToken,
        message: 'Password reset is required before continuing',
      };
    }

    const payload = {
      sub: admin.id,
      role: admin.role.id,
      code: admin.role.code,
      email: admin.emailAddress,
      type: this.configService.get<string>('app.admin') ?? 'admin',
    };

    const accessToken = await this.jwtService.signAsync(payload);
    await this.adminRepo.updateLoginFields(admin.id);

    const adminWithRelations =
      (await this.adminRepo.findByIdWithRelations(admin.id)) ?? admin;

    const cacheKey = getAdminInfoCacheKey(admin.id);
    await this.cacheManager.set(cacheKey, adminWithRelations, CacheTTL.ONE_DAY);

    return {
      id: admin.id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      emailAddress: admin.emailAddress,
      isActive: admin.isActive,
      isVerified: admin.isVerified,
      loginCount: admin.loginCount + 1,
      lastLogin: admin.lastLogin,
      role: admin.role,
      accessToken,
    };
  }

  async verifyUserEmail(token: string): Promise<object> {
    await this.verification.verifyUser(token);
    return { message: 'Email verified successfully' };
  }

  async verifyAdminEmail(token: string): Promise<object> {
    await this.verification.verifyAdmin(token);
    return { message: 'Email verified successfully' };
  }

  async resendUserVerification(dto: ResendVerificationDto): Promise<object> {
    await this.verification.resendForUser(dto.email);
    return {
      message: 'Verification email sent if the account requires verification',
    };
  }

  async resendAdminVerification(dto: ResendVerificationDto): Promise<object> {
    await this.verification.resendForAdmin(dto.email);
    return {
      message: 'Verification email sent if the account requires verification',
    };
  }

  async requestPasswordResetToken(emailAddress: string): Promise<object> {
    const validUser = await this.userRepo.findOneByEmail(emailAddress);

    if (!validUser) {
      return {
        message: 'Password Reset link sent if user email is valid',
      };
    }

    const passwordResetToken =
      await this.createUserPasswordResetToken(validUser);

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
      message: 'Password Reset link sent if user email is valid',
    };
  }

  async requestPasswordReset(resetObj: ResetPasswordDto): Promise<object> {
    const tokenHash = this.passwordHelper.hashbySHA256(
      resetObj.passwordResetToken,
    );
    const passwordResetRecord = await this.passwordResetsRepo.findOne({
      where: { tokenHash },
      relations: { user: true },
    });

    if (
      !passwordResetRecord ||
      passwordResetRecord.usedAt ||
      passwordResetRecord.expiresAt <= new Date()
    ) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    this.validateNewPassword(resetObj);

    const hashedPassword = await this.passwordHelper.hashUserPassword(
      resetObj.password,
    );
    await this.userRepo.updatePassword(
      passwordResetRecord.user.id,
      hashedPassword,
    );
    await this.passwordResetsRepo.update(passwordResetRecord.id, {
      usedAt: new Date(),
    });

    return {
      message: 'Password reset was successful',
    };
  }

  async requestAdminPasswordResetToken(emailAddress: string): Promise<object> {
    const admin = await this.adminRepo.findOneByEmail(emailAddress);

    if (!admin) {
      return {
        message: 'Password Reset link sent if admin email is valid',
      };
    }

    const passwordResetToken = await this.createAdminPasswordResetToken(admin);

    await this.notify.sendMailTrap({
      to: admin.emailAddress,
      subject: 'Admin Password Reset',
      message: `Dear ${admin.firstName} ${admin.lastName},\nUse this token to reset your password: ${passwordResetToken}\nThe link expires in 1 hour.`,
      html: `<p>Dear ${admin.firstName} ${admin.lastName},</p><p>Use this token to reset your password: ${passwordResetToken}</p><p>The link expires in 1 hour.</p>`,
    });

    return {
      message: 'Password Reset link sent if admin email is valid',
    };
  }

  async requestAdminPasswordReset(resetObj: ResetPasswordDto): Promise<object> {
    const tokenHash = this.passwordHelper.hashbySHA256(
      resetObj.passwordResetToken,
    );
    const passwordResetRecord = await this.adminPasswordResetsRepo.findOne({
      where: { tokenHash },
      relations: { admin: true },
    });

    if (
      !passwordResetRecord ||
      passwordResetRecord.usedAt ||
      passwordResetRecord.expiresAt <= new Date()
    ) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    this.validateNewPassword(resetObj);
    const hashedPassword = await this.passwordHelper.hashUserPassword(
      resetObj.password,
    );
    await this.adminRepo.updatePassword(
      passwordResetRecord.admin.id,
      hashedPassword,
    );
    await this.adminPasswordResetsRepo.update(passwordResetRecord.id, {
      usedAt: new Date(),
    });

    return { message: 'Admin password reset was successful' };
  }

  private async createUserPasswordResetToken(user: User) {
    await this.passwordResetsRepo.update(
      { user, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    const passwordResetToken = randomBytes(32).toString('hex');
    await this.passwordResetsRepo.save(
      this.passwordResetsRepo.create({
        user,
        tokenHash: this.passwordHelper.hashbySHA256(passwordResetToken),
        expiresAt: addHours(new Date(), 1),
      }),
    );
    return passwordResetToken;
  }

  private async createAdminPasswordResetToken(admin: Admin) {
    await this.adminPasswordResetsRepo.update(
      { admin, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    const passwordResetToken = randomBytes(32).toString('hex');
    await this.adminPasswordResetsRepo.save(
      this.adminPasswordResetsRepo.create({
        admin,
        tokenHash: this.passwordHelper.hashbySHA256(passwordResetToken),
        expiresAt: addHours(new Date(), 1),
      }),
    );
    return passwordResetToken;
  }

  private validateNewPassword(resetObj: ResetPasswordDto): void {
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
  }
}
