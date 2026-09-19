import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PollingUnit } from './polling-unit.entity';
import { CreatePollingUnitDto, UpdatePollingUnitDto } from './polling-unit.dto';

@Injectable()
export class PollingUnitRepository {
  constructor(
    @InjectRepository(PollingUnit)
    private readonly repository: Repository<PollingUnit>,
  ) {}

  async create(
    createPollingUnitDto: CreatePollingUnitDto,
  ): Promise<PollingUnit> {
    const pollingUnit = this.repository.create({
      name: createPollingUnitDto.name,
      puCode: createPollingUnitDto.puCode,
      registeredVoters: createPollingUnitDto.registeredVoters,
      ward: { id: createPollingUnitDto.wardId },
    });
    return this.repository.save(pollingUnit);
  }

  async bulkInsert(
    pollingUnits: Record<string, string | number | undefined>[],
  ): Promise<void> {
    if (!pollingUnits || pollingUnits.length === 0) return;

    const entities = pollingUnits.map((data) => {
      const entity = this.repository.create({
        name: data.name as string,
        puCode: data.puCode as string,
        registeredVoters:
          data.registeredVoters !== undefined && data.registeredVoters !== null
            ? Number(data.registeredVoters)
            : undefined,
        ward: { id: data.wardId as number },
      });
      return entity;
    });

    await this.repository
      .createQueryBuilder()
      .insert()
      .into(PollingUnit)
      .values(entities)
      .orIgnore() // Skips polling units that already exist (based on unique constraint)
      .execute();
  }

  async findAll(): Promise<PollingUnit[]> {
    return this.repository.find({
      relations: { ward: true },
      order: { name: 'ASC' },
    });
  }

  async findByWard(wardId: number): Promise<PollingUnit[]> {
    return this.repository.find({
      where: { ward: { id: wardId } },
      relations: { ward: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<PollingUnit | null> {
    return this.repository.findOne({
      where: { id },
      relations: { ward: true },
    });
  }

  async findByNameAndWard(
    name: string,
    wardId: number,
  ): Promise<PollingUnit | null> {
    return this.repository.findOne({
      where: { name, ward: { id: wardId } },
    });
  }

  async findByPuCode(puCode: string): Promise<PollingUnit | null> {
    return this.repository.findOne({
      where: { puCode },
    });
  }

  async update(
    id: number,
    updatePollingUnitDto: UpdatePollingUnitDto,
  ): Promise<PollingUnit | null> {
    const updateData: {
      name?: string;
      puCode?: string;
      registeredVoters?: number;
      ward?: { id: number };
    } = {};

    if (updatePollingUnitDto.name !== undefined) {
      updateData.name = updatePollingUnitDto.name;
    }
    if (updatePollingUnitDto.puCode !== undefined) {
      updateData.puCode = updatePollingUnitDto.puCode;
    }
    if (updatePollingUnitDto.registeredVoters !== undefined) {
      updateData.registeredVoters = updatePollingUnitDto.registeredVoters;
    }
    if (updatePollingUnitDto.wardId !== undefined) {
      updateData.ward = { id: updatePollingUnitDto.wardId };
    }

    await this.repository.update({ id }, updateData);
    return this.findOne(id);
  }

  async remove(id: number): Promise<PollingUnit | null> {
    const pollingUnit = await this.findOne(id);
    if (!pollingUnit) {
      return null;
    }
    return this.repository.remove(pollingUnit);
  }
}
