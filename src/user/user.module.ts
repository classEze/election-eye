import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { DatabaseModule } from 'src/default-modules/database.module';
import { UserRepository } from './user.repository';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [DatabaseModule, NotificationModule],
  controllers: [UserController],
  providers: [UserService, UserRepository],
  exports: [UserRepository],
})
export class UserModule {}
