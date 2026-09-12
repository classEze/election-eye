import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from 'src/features/user/user.module';
import { JwtDefaultModule } from 'src/shared/default-modules/jwt.module';
import { NotificationModule } from 'src/shared/notification/notification.module';
import { DatabaseModule } from 'src/shared/default-modules/database.module';
import { VerificationModule } from 'src/shared/verification/verification.module';
import { AdminModule } from 'src/features/admin/admin.module';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  imports: [
    UserModule,
    JwtDefaultModule,
    NotificationModule,
    DatabaseModule,
    VerificationModule,
    AdminModule,
  ],
})
export class AuthModule {}
