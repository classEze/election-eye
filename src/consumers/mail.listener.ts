import { APP_QUEUES } from '@/shared/constants/queue.constants';
import {
  InjectQueue,
  QueueEventsListener,
  QueueEventsHost,
  OnQueueEvent,
} from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

// 💡 Change the string parameter to match the specific queue name you want to track
@QueueEventsListener(APP_QUEUES.mail)
export class EmailQueueEventsListener extends QueueEventsHost {
  private readonly logger = new Logger(EmailQueueEventsListener.name);

  constructor(@InjectQueue(APP_QUEUES.mail) private readonly queue: Queue) {
    super();
  }

  // 1. Triggers when an item enters the queue and becomes active
  @OnQueueEvent('active')
  async onActive(job: { jobId: string; prev?: string }): Promise<void> {
    const jobName = await this.getJobName(job.jobId);
    this.logger.log(
      `🚀 Job ID [${job.jobId}] , Job Name [${jobName}] is now ACTIVE and processing.`,
    );
  }

  // 2. Triggers when a job completes successfully
  @OnQueueEvent('completed')
  async onCompleted(job: {
    jobId: string;
    returnvalue: string;
    prev?: string;
  }): Promise<void> {
    const jobName = await this.getJobName(job.jobId);
    this.logger.log(
      `✅ Job ID [${job.jobId}] , Job Name [${jobName}] COMPLETED successfully.`,
    );
  }

  // 3. Triggers when a job fails
  @OnQueueEvent('failed')
  async onFailed(job: {
    jobId: string;
    failedReason: string;
    prev?: string;
  }): Promise<void> {
    const jobName = await this.getJobName(job.jobId);
    this.logger.error(
      `❌ Job ID [${job.jobId}] , Job Name [${jobName}] FAILED. Reason: ${job.failedReason}`,
    );
  }

  // 4. Optional: Triggers the absolute moment a job enters the waiting pool
  @OnQueueEvent('waiting')
  async onWaiting(job: { jobId: string; prev?: string }): Promise<void> {
    const jobName = await this.getJobName(job.jobId);
    this.logger.debug(
      `📥 Job ID [${job.jobId}] , Job Name [${jobName}] ENTERED the queue (Waiting).`,
    );
  }

  private async getJobName(jobId: string): Promise<string> {
    const job = await this.queue.getJob(jobId);
    return job?.name ?? 'unknown';
  }
}
