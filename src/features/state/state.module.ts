import { Module } from '@nestjs/common';
import { StateService } from './state.service';
import { StateController } from './state.controller';
import { State } from './state.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  controllers: [StateController],
  providers: [StateService],
  imports: [TypeOrmModule.forFeature([State])],
})
export class StateModule {}
