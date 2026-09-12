import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { State } from './state.entity';
import { CreateStateDto, UpdateStateDto } from './state.dto';

@Injectable()
export class StateRepository {
  constructor(
    @InjectRepository(State)
    private readonly repository: Repository<State>,
  ) {}

  async create(createStateDto: CreateStateDto): Promise<State> {
    return this.repository.save(createStateDto);
  }

  async bulkInsert(states: Record<string, string | number>[]): Promise<void> {
    if (!states || states.length === 0) return;
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(State)
      .values(states)
      .orIgnore() // Skips states that already exist (based on unique constraint)
      .execute();
  }

  async findAll(): Promise<State[]> {
    return this.repository.find({
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<State | null> {
    return this.repository.findOneBy({ id });
  }

  async findByName(name: string): Promise<State | null> {
    return this.repository.findOneBy({ name });
  }

  async update(
    id: number,
    updateStateDto: UpdateStateDto,
  ): Promise<State | null> {
    await this.repository.update({ id }, updateStateDto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<State | null> {
    const state = await this.findOne(id);
    if (!state) {
      return null;
    }
    return this.repository.remove(state);
  }
}
