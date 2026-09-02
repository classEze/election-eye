import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { NotificationException } from 'src/auth/notification.exception';
import { EmailDto, TermiiResponse } from '../notification.types';

@Injectable()
export class TermiiService {
  private readonly logger = new Logger(TermiiService.name);
  private baseUrl;
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = config.get<string>('TERMII_BASE_URL');
  }

  // SPECIFIC FOR SENDING SMS
  async sendSMS(to: string, message: string) {
    const payload = {
      api_key: this.config.get<string>('TERMII_API_KEY'),
      to,
      from: this.config.get<string>('TERMII_SENDER_ID'),
      sms: message,
      type: 'plain',
      channel: 'generic',
    };
    try {
      this.logger.log('Sending SMS notification to ' + to);
      return this.post<TermiiResponse>('/sms/send', payload);
    } catch (err) {
      console.log(err);
    }
  }
  async sendEMail(data: EmailDto) {
    const payload = {
      api_key: this.config.get<string>('TERMII_API_KEY'),
      email_address: data.to,
      subject: data.subject,
      body: data.message,
    };

    try {
      this.logger.log('Sending Email notification to ' + data.to);
      return this.post<TermiiResponse>('/email/send', payload);
    } catch (err) {
      console.log(err);
    }
  }

  // GENERIC METHOD THAT CALLS THE TERMII ENDPOINT TO SEND NOTIFICATION
  private async post<T>(endpoint: string, payload: object): Promise<T> {
    try {
      const { data } = await firstValueFrom(
        this.http.post<T>(`${this.baseUrl}${endpoint}`, payload),
      );
      this.logger.log('Notification succeaafully delivered');
      return data;
    } catch (error: unknown) {
      this.handleError(error as AxiosError<TermiiResponse>);
    }
  }

  // HANDLE ANY TERMII ERROR RESPONSE
  private handleError(error: AxiosError<TermiiResponse>): never {
    this.logger.error(error.message);
    if (error.response) {
      throw new NotificationException(
        error.response.data.message ?? 'Notification provider error',
      );
    }
    throw new NotificationException('Unable to reach notification provider');
  }
}
