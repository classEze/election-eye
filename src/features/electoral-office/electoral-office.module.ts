import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElectoralOffice } from './electoral-office.entity';
import { ElectoralOfficeController } from './electoral-office.controller';
import { ElectoralOfficeService } from './electoral-office.service';
import { ElectoralOfficeRepository } from './electoral-office.repository';
import { State } from '../state/state.entity';
import { Lga } from '../lga/lga.entity';
import { Ward } from '../ward/ward.entity';
import { PollingUnit } from '../polling-unit/polling-unit.entity';
import { Aspirant } from '../aspirant/aspirant.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ElectoralOffice,
      State,
      Lga,
      Ward,
      PollingUnit,
      Aspirant,
    ]),
  ],
  controllers: [ElectoralOfficeController],
  providers: [ElectoralOfficeService, ElectoralOfficeRepository],
  exports: [ElectoralOfficeService, ElectoralOfficeRepository],
})
export class ElectoralOfficeModule {}
