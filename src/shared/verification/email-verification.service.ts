import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { addMinutes } from 'date-fns';
import { randomBytes } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';
import { AdminEmailVerificationToken } from '../../features/admin/admin-email-verification-token.entity';
import { User } from '../../features/user/user.entity';
import PasswordHelper from '../helpers/password.helper';
import { NotificationService } from '../notification/notification.service';
import { Admin } from 'src/features/admin/admin.entity';
import { UserEmailVerificationToken } from '../entities/user-email-verification-token.entity';

const TOKEN_LIFETIME_MINUTES = 30;

@Injectable()
export class EmailVerificationService {
  private readonly passwordHelper = new PasswordHelper();

  constructor(
    @InjectRepository(UserEmailVerificationToken)
    private readonly userTokens: Repository<UserEmailVerificationToken>,
    @InjectRepository(AdminEmailVerificationToken)
    private readonly adminTokens: Repository<AdminEmailVerificationToken>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Admin)
    private readonly admins: Repository<Admin>,
    private readonly notify: NotificationService,
  ) {}

  async issueForUser(user: User, temporaryPassword?: string): Promise<void> {
    await this.userTokens.update(
      { user, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    const token = randomBytes(32).toString('hex');
    await this.userTokens.save(
      this.userTokens.create({
        user,
        tokenHash: this.passwordHelper.hashbySHA256(token),
        expiresAt: addMinutes(new Date(), TOKEN_LIFETIME_MINUTES),
      }),
    );
    await this.sendVerificationEmail(
      user.emailAddress,
      user.firstName,
      token,
      temporaryPassword,
    );
  }

  async issueForAdmin(admin: Admin): Promise<void> {
    await this.adminTokens.update(
      { admin, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    const token = randomBytes(32).toString('hex');
    await this.adminTokens.save(
      this.adminTokens.create({
        admin,
        tokenHash: this.passwordHelper.hashbySHA256(token),
        expiresAt: addMinutes(new Date(), TOKEN_LIFETIME_MINUTES),
      }),
    );
    await this.sendVerificationEmail(
      admin.emailAddress,
      admin.firstName,
      token,
    );
  }

  async verifyUser(token: string): Promise<void> {
    const record = await this.userTokens.findOne({
      where: { tokenHash: this.passwordHelper.hashbySHA256(token) },
      relations: { user: true },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
    }
    await this.users.update(record.user.id, {
      isVerified: true,
      isActive: true,
    });
    await this.userTokens.update(record.id, { usedAt: new Date() });
  }

  async resendForUser(email: string): Promise<void> {
    const user = await this.users.findOne({ where: { emailAddress: email } });
    if (user && !user.isVerified) {
      await this.issueForUser(user);
    }
  }

  async resendForAdmin(email: string): Promise<void> {
    const admin = await this.admins.findOne({ where: { emailAddress: email } });
    if (admin && !admin.isVerified) {
      await this.issueForAdmin(admin);
    }
  }

  async verifyAdmin(token: string): Promise<void> {
    const record = await this.adminTokens.findOne({
      where: { tokenHash: this.passwordHelper.hashbySHA256(token) },
      relations: { admin: true },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
    }
    await this.admins.update(record.admin.id, {
      isVerified: true,
      isActive: true,
    });
    await this.adminTokens.update(record.id, { usedAt: new Date() });
  }

  private sendVerificationEmail(
    email: string,
    firstName: string,
    token: string,
    temporaryPassword?: string,
  ): Promise<void> {
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    const link = `${appUrl}/verify-email?token=${encodeURIComponent(token)}`;
    const temporaryPasswordMessage = temporaryPassword
      ? ` Your temporary password is: ${temporaryPassword}.`
      : '';
    const temporaryPasswordHtml = temporaryPassword
      ? `<p>Temporary password: ${temporaryPassword}</p>`
      : '';
    return this.notify.sendMailTrap({
      to: email,
      subject: 'Verify your email address',
      message: `Hello ${firstName}, verify your email using this link: ${link}. The link expires in ${TOKEN_LIFETIME_MINUTES} minutes.${temporaryPasswordMessage}`,
      html: `<p>Hello ${firstName},</p><p><a href="${link}">Verify your email address</a></p><p>This link expires in ${TOKEN_LIFETIME_MINUTES} minutes.</p>${temporaryPasswordHtml}`,
    });
  }
}
