import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { TermiiModule } from './termii/termii.module';

@Module({
  providers: [NotificationService],
  exports: [NotificationService],
  imports: [TermiiModule],
})
export class NotificationModule {}
