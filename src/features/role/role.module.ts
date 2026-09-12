import { Module } from '@nestjs/common';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';
import { Role } from 'src/features/role/role.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  controllers: [RoleController],
  providers: [RoleService],
  imports: [TypeOrmModule.forFeature([Role])],
})
export class RoleModule {}
