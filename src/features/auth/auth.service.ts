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
import { CreateUserDto } from 'src/features/user/user.dto';
import { User } from 'src/features/user/user.entity';
import { UserRepository } from 'src/features/user/user.repository';
import { IsNull, Repository } from 'typeorm';
import {
  ChangePasswordDto,
  ClientType,
  ResendVerificationDto,
  ResetPasswordDto,
} from './auth.dto';
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
import { InjectQueue } from '@nestjs/bullmq';
import {
  APP_QUEUES,
  QueueDictionary,
} from 'src/shared/constants/queue.constants';
import { Queue } from 'bullmq';
import { UserStatus } from 'src/shared/enums/status.enum';
import { EmailTemplateHelper } from 'src/shared/templates/email-template.helper';

@Injectable()
export class AuthService {
  private readonly passwordHelper = new PasswordHelper();

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly userRepo: UserRepository,
    private readonly jwtService: JwtService,
    @InjectRepository(PasswordResets)
    private readonly passwordResetsRepo: Repository<PasswordResets>,
    @InjectRepository(AdminPasswordResets)
    private readonly adminPasswordResetsRepo: Repository<AdminPasswordResets>,
    private readonly verification: EmailVerificationService,
    private readonly adminRepo: AdminRepository,
    private readonly configService: ConfigService,
    @InjectQueue(APP_QUEUES.mail) private readonly mailQueue: Queue,
  ) {}

  async signIn(LoginUserObj: {
    emailAddress: string;
    password: string;
    clientType?: ClientType;
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

    if (validUser.status !== UserStatus.ACTIVE) {
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

    const clientType = LoginUserObj.clientType || ClientType.WEB;
    const payload = {
      sub: validUser.id,
      role: validUser.role.id,
      code: validUser.role.code,
      email: validUser.emailAddress,
      type: this.configService.get<string>('app.client') ?? 'client',
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.jwtService.signAsync(
      { ...payload, tokenType: 'refresh' },
      { expiresIn: '12h' },
    );

    await this.userRepo.updateLoginFields(validUser.id);

    const userWithRelations =
      (await this.userRepo.findByIdWithRelations(validUser.id)) ?? validUser;

    const cacheKey = getUserInfoCacheKey(validUser.id);
    await this.cacheManager.set(cacheKey, userWithRelations, CacheTTL.ONE_DAY);

    return { ...userWithRelations, accessToken, refreshToken, clientType };
  }

  async adminSignIn(loginAdminObj: {
    emailAddress: string;
    password: string;
    clientType?: ClientType;
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

    if (admin.status !== UserStatus.ACTIVE) {
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

    const clientType = loginAdminObj.clientType || ClientType.WEB;
    const payload = {
      sub: admin.id,
      role: admin.role.id,
      code: admin.role.code,
      email: admin.emailAddress,
      type: this.configService.get<string>('app.admin') ?? 'admin',
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.jwtService.signAsync(
      { ...payload, tokenType: 'refresh' },
      { expiresIn: '12h' },
    );

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
      status: admin.status,
      isVerified: admin.isVerified,
      loginCount: admin.loginCount + 1,
      lastLogin: admin.lastLogin,
      role: admin.role,
      accessToken,
      refreshToken,
      clientType,
    };
  }

  async refreshTokens(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user?: any;
    admin?: any;
  }> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    try {
      const payload = await this.jwtService.verifyAsync(refreshToken);
      if (!payload || payload.tokenType !== 'refresh') {
        throw new UnauthorizedException('Invalid token type for refresh');
      }

      const adminType = this.configService.get<string>('app.admin') ?? 'admin';
      const isAdministrator = payload.type === adminType;

      if (isAdministrator) {
        const admin = await this.adminRepo.findOneById(payload.sub);
        if (!admin || admin.status !== UserStatus.ACTIVE) {
          throw new UnauthorizedException(
            'Administrator account is inactive or not found',
          );
        }

        const newPayload = {
          sub: admin.id,
          role: admin.role.id,
          code: admin.role.code,
          email: admin.emailAddress,
          type: adminType,
        };

        const newAccessToken = await this.jwtService.signAsync(newPayload);
        const newRefreshToken = await this.jwtService.signAsync(
          { ...newPayload, tokenType: 'refresh' },
          { expiresIn: '12h' },
        );

        return {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          admin,
        };
      } else {
        const user = await this.userRepo.findOneById(payload.sub);
        if (!user || user.status !== UserStatus.ACTIVE) {
          throw new UnauthorizedException(
            'User account is inactive or not found',
          );
        }

        const newPayload = {
          sub: user.id,
          role: user.role.id,
          code: user.role.code,
          email: user.emailAddress,
          type: this.configService.get<string>('app.client') ?? 'client',
        };

        const newAccessToken = await this.jwtService.signAsync(newPayload);
        const newRefreshToken = await this.jwtService.signAsync(
          { ...newPayload, tokenType: 'refresh' },
          { expiresIn: '12h' },
        );

        return {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          user,
        };
      }
    } catch (error: any) {
      throw new UnauthorizedException(
        error?.message || 'Invalid or expired refresh token',
      );
    }
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

    if (validUser.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(
        'Your account is inactive. Please contact the system administrator.',
      );
    }

    const passwordResetToken =
      await this.createUserPasswordResetToken(validUser);

    const rawUrl =
      this.configService.get<string>('app.clientAppUrl') ||
      process.env.CLIENT_APP_URL ||
      process.env.APP_URL ||
      'https://election-eye-1pa1-pi.vercel.app';
    const portalUrl = rawUrl.replace(/\/+$/, '');
    const resetUrl = `${portalUrl}/reset-password?token=${encodeURIComponent(passwordResetToken)}`;

    const html = EmailTemplateHelper.render({
      title: 'Password Reset Request',
      greeting: `Hello ${validUser.firstName} ${validUser.lastName},`,
      paragraphs: [
        'We received a request to reset your password for your Election Eye account.',
        'Please click the button below to set a new password, or use the token directly.',
      ],
      actionButton: {
        text: 'Reset Password',
        url: resetUrl,
      },
      highlightBox: {
        label: 'Password Reset Token',
        value: passwordResetToken,
        subtext: 'Token is valid for 1 hour.',
      },
      notes: [
        'If you did not request a password reset, please safely ignore this email.',
        'For security reasons, this token will expire in 60 minutes.',
      ],
    });

    await this.mailQueue.add(QueueDictionary.SEND_MAIL, {
      to: validUser.emailAddress,
      subject: 'Password Reset',
      message: `Dear ${validUser.firstName} ${validUser.lastName},\nYou requested a password reset. Use the token below to reset your password: ${passwordResetToken}\nThe link expires in 1 hour.`,
      html,
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
    await this.userRepo.updatePasswordAndVerify(
      passwordResetRecord.user.id,
      hashedPassword,
    );
    await this.cacheManager.del(
      getUserInfoCacheKey(passwordResetRecord.user.id),
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

    if (admin.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(
        'Your account is inactive. Please contact the system administrator.',
      );
    }

    const passwordResetToken = await this.createAdminPasswordResetToken(admin);
    const rawUrl =
      this.configService.get<string>('app.adminAppUrl') ||
      process.env.ADMIN_APP_URL ||
      'https://elect-system-admin.vercel.app';
    const portalUrl = rawUrl.replace(/\/+$/, '');
    const resetUrl = `${portalUrl}/admin-reset-password?token=${encodeURIComponent(passwordResetToken)}`;

    const html = EmailTemplateHelper.render({
      title: 'Administrator Password Reset Request',
      greeting: `Dear ${admin.firstName} ${admin.lastName},`,
      paragraphs: [
        'An administrative password reset request has been initiated for your account on Election Eye.',
        'Please click the button below to set a new password, or use the token directly.',
      ],
      actionButton: {
        text: 'Reset Admin Password',
        url: resetUrl,
      },
      highlightBox: {
        label: 'Admin Reset Token',
        value: passwordResetToken,
        subtext: 'Token is valid for 1 hour.',
      },
      notes: [
        'This administrative token expires in 1 hour.',
        'If you did not request this change, please alert the security team immediately.',
      ],
    });

    await this.mailQueue.add(QueueDictionary.SEND_MAIL, {
      to: admin.emailAddress,
      subject: 'Admin Password Reset',
      message: `Dear ${admin.firstName} ${admin.lastName},\nUse this token to reset your password: ${passwordResetToken}\nThe link expires in 1 hour.`,
      html,
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
    await this.adminRepo.updatePasswordAndVerify(
      passwordResetRecord.admin.id,
      hashedPassword,
    );
    await this.cacheManager.del(
      getAdminInfoCacheKey(passwordResetRecord.admin.id),
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

  async changeUserPassword(userId: number, dto: ChangePasswordDto) {
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException(
        'New password cannot be the same as the current password.',
      );
    }

    this.validateNewPassword({
      password: dto.newPassword,
      confirmPassword: dto.confirmPassword,
      passwordResetToken: '',
    });

    const user = await this.userRepo.findByIdWithPassword(userId);
    if (!user || !user.password) {
      throw new UnauthorizedException('User account not found.');
    }

    const isMatch = await this.passwordHelper.verifyUserPassword(
      dto.currentPassword,
      user.password,
    );
    if (!isMatch) {
      throw new BadRequestException('Current password is incorrect.');
    }

    const hashedPassword = await this.passwordHelper.hashUserPassword(
      dto.newPassword,
    );

    await this.userRepo.updatePassword(userId, hashedPassword);
    await this.cacheManager.del(getUserInfoCacheKey(userId));

    return {
      message: 'Password changed successfully.',
    };
  }

  async changeAdminPassword(adminId: number, dto: ChangePasswordDto) {
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException(
        'New password cannot be the same as the current password.',
      );
    }

    this.validateNewPassword({
      password: dto.newPassword,
      confirmPassword: dto.confirmPassword,
      passwordResetToken: '',
    });

    const admin = await this.adminRepo.findByIdWithPassword(adminId);
    if (!admin || !admin.password) {
      throw new UnauthorizedException('Administrator account not found.');
    }

    const isMatch = await this.passwordHelper.verifyUserPassword(
      dto.currentPassword,
      admin.password,
    );
    if (!isMatch) {
      throw new BadRequestException('Current password is incorrect.');
    }

    const hashedPassword = await this.passwordHelper.hashUserPassword(
      dto.newPassword,
    );

    await this.adminRepo.updatePassword(adminId, hashedPassword);
    await this.cacheManager.del(getAdminInfoCacheKey(adminId));

    return {
      message: 'Admin password changed successfully.',
    };
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
