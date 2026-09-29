import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserRepository } from './user.repository';
import { NotificationModule } from 'src/shared/notification/notification.module';
import { VerificationModule } from 'src/shared/verification/verification.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Ward } from '../ward/ward.entity';
import { PollingUnit } from '../polling-unit/polling-unit.entity';
import { Lga } from '../lga/lga.entity';
import { Aspirant } from '../aspirant/aspirant.entity';
import { RoleModule } from '../role/role.module';
import { ElectoralOfficeModule } from '../electoral-office/electoral-office.module';

@Module({
  imports: [
    NotificationModule,
    VerificationModule,
    TypeOrmModule.forFeature([User, Ward, PollingUnit, Lga, Aspirant]),
    RoleModule,
    ElectoralOfficeModule,
  ],
  controllers: [UserController],
  providers: [UserService, UserRepository],
  exports: [UserService, UserRepository],
})
export class UserModule {}
