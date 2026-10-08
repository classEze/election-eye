import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EmailDto } from '../notification.types';

@Injectable()
export class ResendService {
  private readonly logger = new Logger(ResendService.name);
  private resendClient: Resend | null = null;
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey =
      this.configService.get<string>('resend.apiKey') ||
      process.env.RESEND_API_KEY ||
      (process.env.MAIL_PASS?.startsWith('re_') ? process.env.MAIL_PASS : null);

    this.fromEmail =
      this.configService.get<string>('mail.from') ||
      process.env.MAIL_FROM ||
      'Election Eye <noreply@election-eye.com>';

    if (apiKey) {
      this.resendClient = new Resend(apiKey);
      this.logger.log('Resend SDK client initialized successfully');
    } else {
      this.logger.warn(
        'RESEND_API_KEY is not set. ResendService will fallback or fail if invoked directly.',
      );
    }
  }

  /**
   * Sends an email via the official Resend Node.js SDK (HTTPS REST API).
   */
  async sendMail(mail: EmailDto): Promise<any> {
    if (!this.resendClient) {
      const apiKey =
        this.configService.get<string>('resend.apiKey') ||
        process.env.RESEND_API_KEY ||
        (process.env.MAIL_PASS?.startsWith('re_') ? process.env.MAIL_PASS : null);

      if (apiKey) {
        this.resendClient = new Resend(apiKey);
      } else {
        throw new Error(
          'Cannot send email via Resend: RESEND_API_KEY is missing in environment configuration.',
        );
      }
    }

    try {
      this.logger.log(`Dispatching email via Resend SDK to: ${mail.to}`);

      const response = await this.resendClient.emails.send({
        from: this.fromEmail,
        to: Array.isArray(mail.to) ? mail.to : [mail.to],
        subject: mail.subject,
        text: mail.message,
        html: mail.html || `<p>${mail.message}</p>`,
      });

      if (response.error) {
        this.logger.error(
          `Resend API error sending to ${mail.to}: ${response.error.message}`,
        );
        throw new Error(response.error.message);
      }

      this.logger.log(
        `Email successfully delivered to Resend for ${mail.to} (Message ID: ${response.data?.id})`,
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(
        `Failed to send email via Resend SDK to ${mail.to}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
