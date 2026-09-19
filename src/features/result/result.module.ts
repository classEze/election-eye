import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Incident } from '../incident/incident.entity';
import { PoliticalParty } from '../political-party/political-party.entity';
import { ResultDetail } from '../result-detail/result-detail.entity';
import { IncidentCategory } from '../../shared/entities/incident-category.entity';
import { Result } from './result.entity';
import { ResultController } from './result.controller';
import { ResultService } from './result.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Result,
      ResultDetail,
      PoliticalParty,
      Incident,
      IncidentCategory,
    ]),
  ],
  controllers: [ResultController],
  providers: [ResultService],
  exports: [ResultService],
})
export class ResultModule {}
