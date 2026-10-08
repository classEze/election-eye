import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { TermiiModule } from './termii/termii.module';
import { ResendModule } from './resend/resend.module';

@Module({
  imports: [TermiiModule, ResendModule],
  providers: [NotificationService],
  exports: [NotificationService, ResendModule],
})
export class NotificationModule {}
