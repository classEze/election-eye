import { Injectable, Logger } from '@nestjs/common';
import { TermiiService } from './termii/termii.service';
import { MailerService } from '@nestjs-modules/mailer';
import { EmailDto } from './notification.types';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly termiiService: TermiiService,
    private readonly mailerService: MailerService,
  ) {}

  sendSMS(sms: { to: string; message: string }) {
    return this.termiiService.sendSMS(sms.to, sms.message);
  }

  async sendMailTrap(mail: EmailDto) {
    try {
      this.logger.log('Sending email notification to ' + mail.to);
      await this.mailerService.sendMail({
        to: mail.to,
        subject: mail.subject,
        text: mail.message,
        html: mail.html,
      });
      this.logger.log('Email notification sent successfully to ' + mail.to);
    } catch (error) {
      this.logger.error('Failed to send email notification', error);
    }
  }
}
