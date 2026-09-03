// database.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordResets } from 'src/entities/password-resets.entity';
import { Role } from 'src/entities/role.entity';
import { User } from 'src/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Role, User, PasswordResets])],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
