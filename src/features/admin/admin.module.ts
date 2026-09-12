import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminRepository } from './admin.repository';
import { Admin } from './admin.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../role/role.entity';
import { NotificationModule } from 'src/shared/notification/notification.module';
import { VerificationModule } from 'src/shared/verification/verification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Admin, Role]),
    NotificationModule,
    VerificationModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminRepository],
  exports: [AdminRepository],
})
export class AdminModule {}
