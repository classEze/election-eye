import {
  APP_QUEUES,
  QueueDictionary,
} from '@/shared/constants/queue.constants';
import { NotificationService } from '@/shared/notification/notification.service';
import { EmailDto } from '@/shared/notification/notification.types';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor(APP_QUEUES.mail)
export class MailConsumer extends WorkerHost {
  constructor(private readonly notify: NotificationService) {
    super();
  }
  async process(job: Job): Promise<void> {
    switch (job.name) {
      case QueueDictionary.SEND_MAIL:
        await this.notify.sendMailTrap(job.data as EmailDto);
        break;

      default:
        console.log(job);
    }
  }
}
