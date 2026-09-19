import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PollingUnit } from './polling-unit.entity';
import { PollingUnitController } from './polling-unit.controller';
import { PollingUnitService } from './polling-unit.service';
import { PollingUnitRepository } from './polling-unit.repository';
import { WardModule } from '../ward/ward.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PollingUnit]),
    forwardRef(() => WardModule),
  ],
  controllers: [PollingUnitController],
  providers: [PollingUnitService, PollingUnitRepository],
  exports: [PollingUnitService, PollingUnitRepository],
})
export class PollingUnitModule {}
