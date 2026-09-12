import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminEmailVerificationToken } from '../../features/admin/admin-email-verification-token.entity';
import { User } from '../../features/user/user.entity';
import { NotificationModule } from '../notification/notification.module';
import { EmailVerificationService } from './email-verification.service';
import { Admin } from 'src/features/admin/admin.entity';
import { UserEmailVerificationToken } from '../entities/user-email-verification-token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEmailVerificationToken,
      AdminEmailVerificationToken,
      User,
      Admin,
    ]),
    NotificationModule,
  ],
  providers: [EmailVerificationService],
  exports: [EmailVerificationService],
})
export class VerificationModule {}
