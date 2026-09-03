import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from 'src/user/user.module';
import { JwtDefaultModule } from 'src/default-modules/jwt.module';
import { NotificationModule } from 'src/notification/notification.module';
import { DatabaseModule } from 'src/default-modules/database.module';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  imports: [UserModule, JwtDefaultModule, NotificationModule, DatabaseModule],
})
export class AuthModule {}
