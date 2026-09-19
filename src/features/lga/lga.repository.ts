import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lga } from './lga.entity';
import { CreateLgaDto, UpdateLgaDto } from './lga.dto';

@Injectable()
export class LgaRepository {
  constructor(
    @InjectRepository(Lga)
    private readonly repository: Repository<Lga>,
  ) {}

  async create(createLgaDto: CreateLgaDto): Promise<Lga> {
    const lga = this.repository.create({
      ...createLgaDto,
      state: { id: createLgaDto.stateId },
    });
    return this.repository.save(lga);
  }

  async bulkInsert(lgas: Record<string, string | number>[]): Promise<void> {
    if (!lgas || lgas.length === 0) return;

    // Convert to entity objects to ensure proper relation mapping
    const entities = lgas.map((data) => {
      const entity = this.repository.create({
        name: data.name as string,
        lgaCode: data.lgaCode as string,
        state: { id: data.stateId as number },
      });
      return entity;
    });

    await this.repository
      .createQueryBuilder()
      .insert()
      .into(Lga)
      .values(entities)
      .orIgnore() // Skips lgas that already exist (based on unique constraint)
      .execute();
  }

  async findAll(): Promise<Lga[]> {
    return this.repository.find({
      relations: { state: true },
      order: { name: 'ASC' },
    });
  }

  async findByState(stateId: number): Promise<Lga[]> {
    return this.repository.find({
      where: { state: { id: stateId } },
      relations: { state: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Lga | null> {
    return this.repository.findOne({
      where: { id },
      relations: { state: true },
    });
  }

  async findByNameAndState(name: string, stateId: number): Promise<Lga | null> {
    return this.repository.findOne({
      where: { name, state: { id: stateId } },
    });
  }

  async update(id: number, updateLgaDto: UpdateLgaDto): Promise<Lga | null> {
    const updateData: {
      name?: string;
      lgaCode?: string;
      state?: { id: number };
    } = {};

    if (updateLgaDto.name !== undefined) {
      updateData.name = updateLgaDto.name;
    }
    if (updateLgaDto.lgaCode !== undefined) {
      updateData.lgaCode = updateLgaDto.lgaCode;
    }
    if (updateLgaDto.stateId !== undefined) {
      updateData.state = { id: updateLgaDto.stateId };
    }

    await this.repository.update({ id }, updateData);
    return this.findOne(id);
  }

  async remove(id: number): Promise<Lga | null> {
    const lga = await this.findOne(id);
    if (!lga) {
      return null;
    }
    return this.repository.remove(lga);
  }
}
