import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { APP_QUEUES } from '../constants/queue.constants';
import { MailConsumer } from '../../consumers/mail.consumer';
import { EmailQueueEventsListener } from '../../consumers/mail.listener';
import { NotificationModule } from '../notification/notification.module';
import { FileConsumer } from '../../consumers/file.consumer';
import { StateModule } from '../../features/state/state.module';
import { forwardRef } from '@nestjs/common';
import { LgaModule } from '../../features/lga/lga.module';
import { WardModule } from '../../features/ward/ward.module';
import { PollingUnitModule } from '../../features/polling-unit/polling-unit.module';

@Global()
@Module({
  imports: [
    NotificationModule,
    StateModule,
    forwardRef(() => LgaModule),
    forwardRef(() => WardModule),
    forwardRef(() => PollingUnitModule),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return {
          connection: {
            host: config.get<string>('redis.host'),
            port: config.get<number>('redis.port'),
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: APP_QUEUES.mail,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // Wait 5s, then 10s, then 20s
        },
        removeOnComplete: { age: 3600, count: 100 }, // Keep last 100 logs or up to 1 hour
        removeOnFail: { age: 86400, count: 500 },
      },
    }),
    BullModule.registerQueue({
      name: APP_QUEUES.file,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 10000,
        },
        removeOnComplete: { age: 3600, count: 100 }, // Keep last 100 logs or up to 1 hour
        removeOnFail: { age: 86400, count: 500 },
      },
    }),
  ],
  providers: [MailConsumer, EmailQueueEventsListener, FileConsumer],
  exports: [BullModule],
})
export class DefaultQueueModule {}
