import { Module } from '@nestjs/common';
import { StateService } from './state.service';
import { StateController } from './state.controller';
import { State } from './state.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StateRepository } from './state.repository';

@Module({
  imports: [TypeOrmModule.forFeature([State])],
  controllers: [StateController],
  providers: [StateService, StateRepository],
  exports: [StateService, StateRepository],
})
export class StateModule {}
