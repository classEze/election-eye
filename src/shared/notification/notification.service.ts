import { Injectable, Logger } from '@nestjs/common';
import { TermiiService } from './termii/termii.service';
import { MailerService } from '@nestjs-modules/mailer';
import { ResendService } from './resend/resend.service';
import { EmailDto } from './notification.types';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly termiiService: TermiiService,
    private readonly mailerService: MailerService,
    private readonly resendService: ResendService,
    private readonly configService: ConfigService,
  ) {}

  sendSMS(sms: { to: string; message: string }) {
    return this.termiiService.sendSMS(sms.to, sms.message);
  }

  /**
   * Dispatches email notification.
   * If RESEND_API_KEY is configured, uses the official Resend SDK (HTTPS API).
   * Otherwise, falls back to SMTP via MailerService.
   */
  async sendMail(mail: EmailDto) {
    const hasResendApiKey =
      Boolean(this.configService.get<string>('resend.apiKey')) ||
      Boolean(process.env.RESEND_API_KEY) ||
      Boolean(process.env.MAIL_PASS?.startsWith('re_'));

    if (hasResendApiKey) {
      try {
        return await this.resendService.sendMail(mail);
      } catch (error: any) {
        this.logger.error(
          `Resend SDK delivery failed for ${mail.to}. Falling back to SMTP: ${error.message}`,
        );
        return this.sendViaSmtp(mail);
      }
    } else {
      return this.sendViaSmtp(mail);
    }
  }

  private async sendViaSmtp(mail: EmailDto) {
    try {
      this.logger.log(`Sending email notification via SMTP to ${mail.to}`);
      await this.mailerService.sendMail({
        to: mail.to,
        subject: mail.subject,
        text: mail.message,
        html: mail.html,
      });
      this.logger.log(`SMTP email notification sent successfully to ${mail.to}`);
    } catch (error) {
      this.logger.error(`Failed to send email via SMTP to ${mail.to}`, error);
      throw error;
    }
  }

  // Explicit Resend SDK dispatch
  async sendResend(mail: EmailDto) {
    return this.resendService.sendMail(mail);
  }

  // Backwards compatibility alias
  async sendMailTrap(mail: EmailDto) {
    return this.sendMail(mail);
  }
}
