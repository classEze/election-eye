import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { DatabaseModule } from 'src/shared/default-modules/database.module';
import { UserRepository } from './user.repository';
import { NotificationModule } from 'src/shared/notification/notification.module';
import { VerificationModule } from 'src/shared/verification/verification.module';

@Module({
  imports: [DatabaseModule, NotificationModule, VerificationModule],
  controllers: [UserController],
  providers: [UserService, UserRepository],
  exports: [UserRepository],
})
export class UserModule {}
