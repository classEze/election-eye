import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from 'src/features/user/user.module';
import { JwtDefaultModule } from 'src/shared/default-modules/jwt.module';
import { NotificationModule } from 'src/shared/notification/notification.module';
import { VerificationModule } from 'src/shared/verification/verification.module';
import { AdminModule } from 'src/features/admin/admin.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordResets } from '@/shared/entities/password-resets.entity';
import { AdminPasswordResets } from '../admin/admin-password-resets.entity';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  imports: [
    UserModule,
    JwtDefaultModule,
    NotificationModule,
    VerificationModule,
    AdminModule,
    TypeOrmModule.forFeature([PasswordResets, AdminPasswordResets]),
  ],
})
export class AuthModule {}
