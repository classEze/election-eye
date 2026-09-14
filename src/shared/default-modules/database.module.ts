import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from 'src/features/role/role.entity';
import { User } from 'src/features/user/user.entity';
import { PasswordResets } from '../entities/password-resets.entity';
import { AdminPasswordResets } from 'src/features/admin/admin-password-resets.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, User, PasswordResets, AdminPasswordResets]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
