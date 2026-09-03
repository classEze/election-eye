import { Injectable } from '@nestjs/common';
import { CreateStateDto } from './dto/create-state.dto';
import { UpdateStateDto } from './dto/update-state.dto';
import { State } from './entities/state.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class StateService {
  constructor(
    @InjectRepository(State)
    private readonly stateRepo: Repository<State>,
  ) {}

  create(createStateDto: CreateStateDto) {
    return this.stateRepo.save(createStateDto);
  }

  findAll() {
    return this.stateRepo.find();
  }

  findOne(id: number) {
    return this.stateRepo.findOneBy({ id });
  }

  update(id: number, updateStateDto: UpdateStateDto) {
    return this.stateRepo.update({ id }, updateStateDto);
  }

  remove(id: number) {
    return this.stateRepo.remove({ id });
  }
}
