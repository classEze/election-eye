import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PoliticalParty } from './political-party.entity';
import { PoliticalPartyController } from './political-party.controller';
import { PoliticalPartyService } from './political-party.service';
import { PoliticalPartyRepository } from './political-party.repository';
import { StorageModule } from '../../shared/storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([PoliticalParty]), StorageModule],
  controllers: [PoliticalPartyController],
  providers: [PoliticalPartyService, PoliticalPartyRepository],
  exports: [PoliticalPartyService, PoliticalPartyRepository],
})
export class PoliticalPartyModule {}
