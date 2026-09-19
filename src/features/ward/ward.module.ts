import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ward } from './ward.entity';
import { WardController } from './ward.controller';
import { WardService } from './ward.service';
import { WardRepository } from './ward.repository';
import { LgaModule } from '../lga/lga.module';

@Module({
  imports: [TypeOrmModule.forFeature([Ward]), forwardRef(() => LgaModule)],
  controllers: [WardController],
  providers: [WardService, WardRepository],
  exports: [WardService, WardRepository],
})
export class WardModule {}
