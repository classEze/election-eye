import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { State } from './state.entity';
import { CreateStateDto, UpdateStateDto } from './state.dto';

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

  async remove(id: number) {
    const state = await this.stateRepo.findOneBy({ id });
    if (!state) {
      throw new Error(`State with ID ${id} not found`);
    }
    return this.stateRepo.remove(state);
  }
}
