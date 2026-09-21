import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Result } from './result.entity';
import { ResultDetail } from '../result-detail/result-detail.entity';
import { ResultController } from './result.controller';
import { ResultService } from './result.service';
import { ResultRepository } from './result.repository';
import { StorageModule } from '../../shared/storage/storage.module';
import { SystemConfigurationModule } from '../system-configuration/system-configuration.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Result, ResultDetail]),
    StorageModule,
    SystemConfigurationModule,
  ],
  controllers: [ResultController],
  providers: [ResultService, ResultRepository],
  exports: [ResultService, ResultRepository],
})
export class ResultModule {}
