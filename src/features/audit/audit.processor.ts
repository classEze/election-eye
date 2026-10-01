import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import {
  APP_QUEUES,
  QueueDictionary,
} from 'src/shared/constants/queue.constants';
import { AuditRepository } from './audit.repository';
import { CreateAuditLogJobData } from './audit.dto';

@Processor(APP_QUEUES.audit)
export class AuditProcessor extends WorkerHost {
  private readonly logger = new Logger(AuditProcessor.name);

  constructor(private readonly auditRepository: AuditRepository) {
    super();
  }

  async process(job: Job<CreateAuditLogJobData, void, string>): Promise<void> {
    if (job.name === QueueDictionary.RECORD_AUDIT_LOG) {
      try {
        await this.auditRepository.create(job.data);
      } catch (error) {
        this.logger.error(
          `Failed to persist audit log [${job.data.action}]: ${(error as Error).message}`,
          (error as Error).stack,
        );
        throw error;
      }
    }
  }
}
