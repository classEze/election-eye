import { Module } from '@nestjs/common';
import { LgaService } from './lga.service';
import { LgaController } from './lga.controller';
import { Lga } from './lga.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LgaRepository } from './lga.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Lga])],
  controllers: [LgaController],
  providers: [LgaService, LgaRepository],
  exports: [LgaService, LgaRepository],
})
export class LgaModule {}
