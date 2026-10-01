import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AuditLog } from './audit.entity';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';
import { AuditProcessor } from './audit.processor';
import { AuditController } from './audit.controller';
import { APP_QUEUES } from 'src/shared/constants/queue.constants';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
    BullModule.registerQueue({
      name: APP_QUEUES.audit,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: { age: 3600, count: 500 },
        removeOnFail: { age: 86400, count: 1000 },
      },
    }),
  ],
  controllers: [AuditController],
  providers: [AuditRepository, AuditService, AuditProcessor],
  exports: [AuditService, AuditRepository],
})
export class AuditModule {}
