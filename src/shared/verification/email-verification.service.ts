import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { addHours } from 'date-fns';
import { randomBytes } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';
import { AdminEmailVerificationToken } from '../../features/admin/admin-email-verification-token.entity';
import { User } from '../../features/user/user.entity';
import PasswordHelper from '../helpers/password.helper';
import { Admin } from 'src/features/admin/admin.entity';
import { UserEmailVerificationToken } from '../entities/user-email-verification-token.entity';
import { InjectQueue } from '@nestjs/bullmq';
import { APP_QUEUES, QueueDictionary } from '../constants/queue.constants';
import { Queue } from 'bullmq';
import { UserStatus } from 'src/shared/enums/status.enum';
import { EmailTemplateHelper } from '../templates/email-template.helper';

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
    @InjectQueue(APP_QUEUES.mail) private mailQueue: Queue,
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
        expiresAt: addHours(new Date(), 24),
      }),
    );
    await this.sendVerificationEmail(
      user.emailAddress,
      user.firstName,
      token,
      temporaryPassword,
      false, // Client user
    );
  }

  async issueForAdmin(admin: Admin, temporaryPassword?: string): Promise<void> {
    await this.adminTokens.update(
      { admin, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    const token = randomBytes(32).toString('hex');
    await this.adminTokens.save(
      this.adminTokens.create({
        admin,
        tokenHash: this.passwordHelper.hashbySHA256(token),
        expiresAt: addHours(new Date(), 60 * 24),
      }),
    );
    await this.sendVerificationEmail(
      admin.emailAddress,
      admin.firstName,
      token,
      temporaryPassword,
      true, // Admin user
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
      status: UserStatus.ACTIVE,
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
      status: UserStatus.ACTIVE,
    });
    await this.adminTokens.update(record.id, { usedAt: new Date() });
  }

  private async sendVerificationEmail(
    email: string,
    firstName: string,
    token: string,
    temporaryPassword?: string,
    isAdmin = false,
  ): Promise<void> {
    const rawUrl = isAdmin
      ? process.env.ADMIN_APP_URL || 'https://elect-system-admin.vercel.app'
      : process.env.CLIENT_APP_URL ||
        process.env.APP_URL ||
        'https://election-eye-1pa1-pi.vercel.app';

    const portalBaseUrl = rawUrl.replace(/\/+$/, '');
    const link = `${portalBaseUrl}/verify-email?token=${encodeURIComponent(token)}`;

    let subject = 'Verify your email address';
    let message = `Hello ${firstName},\n\nPlease verify your email address using this link: ${link}. The link expires in 24 hours.`;

    let html = EmailTemplateHelper.render({
      title: isAdmin
        ? 'Admin Account Verification'
        : 'Verify Your Email Address',
      greeting: `Hello ${firstName},`,
      paragraphs: [
        `Thank you for joining the Election Eye intelligence platform (${isAdmin ? 'Administrator Portal' : 'Portal'}). Please click the button below to verify your email address and activate your access.`,
      ],
      actionButton: {
        text: 'Verify Email Address',
        url: link,
      },
      notes: [
        'This verification link is valid for 24 hours from the time of issue.',
      ],
    });

    if (temporaryPassword) {
      subject = `Welcome to Election Eye ${isAdmin ? 'Admin Portal' : ''} - Verify Your Account`;
      message = `Hello ${firstName},\n\nWelcome to Election Eye. Please verify your email address using the following link: ${link} (expires in 24 hours).\n\nAfter verification, please proceed to login using the following temporary password:\nTemporary Password: ${temporaryPassword}`;

      html = EmailTemplateHelper.render({
        title: `Welcome to Election Eye ${isAdmin ? 'Admin Portal' : ''} - Account Verification`,
        greeting: `Hello ${firstName},`,
        paragraphs: [
          `An account has been created for you on the Election Eye platform (${isAdmin ? 'Admin' : 'Client'} portal). Please verify your email address by clicking the button below, then sign in with your temporary credentials.`,
        ],
        actionButton: {
          text: 'Verify & Activate Account',
          url: link,
        },
        highlightBox: {
          label: 'Your Temporary Password',
          value: temporaryPassword,
          subtext:
            'You will be prompted to choose a secure new password upon your first sign-in.',
        },
        notes: [
          'This verification link expires in 24 hours.',
          'For your security, do not share your temporary credentials with anyone.',
        ],
      });
    }

    await this.mailQueue.add(QueueDictionary.SEND_MAIL, {
      to: email,
      subject,
      message,
      html,
    });
  }
}
