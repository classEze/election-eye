import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ward } from './ward.entity';
import { CreateWardDto, UpdateWardDto } from './ward.dto';

@Injectable()
export class WardRepository {
  constructor(
    @InjectRepository(Ward)
    private readonly repository: Repository<Ward>,
  ) {}

  async create(createWardDto: CreateWardDto): Promise<Ward> {
    const ward = this.repository.create({
      name: createWardDto.name,
      wardCode: createWardDto.wardCode,
      lga: { id: createWardDto.lgaId },
    });
    return this.repository.save(ward);
  }

  async bulkInsert(wards: Record<string, string | number>[]): Promise<void> {
    if (!wards || wards.length === 0) return;

    // Convert to entity objects to ensure proper relation mapping
    const entities = wards.map((data) => {
      const entity = this.repository.create({
        name: data.name as string,
        wardCode: data.wardCode as string,
        lga: { id: data.lgaId as number },
      });
      return entity;
    });

    await this.repository
      .createQueryBuilder()
      .insert()
      .into(Ward)
      .values(entities)
      .orIgnore() // Skips wards that already exist (based on unique constraint)
      .execute();
  }

  async findAll(): Promise<Ward[]> {
    return this.repository.find({
      relations: { lga: true },
      order: { name: 'ASC' },
    });
  }

  async findByLga(lgaId: number): Promise<Ward[]> {
    return this.repository.find({
      where: { lga: { id: lgaId } },
      relations: { lga: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Ward | null> {
    return this.repository.findOne({
      where: { id },
      relations: { lga: true },
    });
  }

  async findByNameAndLga(name: string, lgaId: number): Promise<Ward | null> {
    return this.repository.findOne({
      where: { name, lga: { id: lgaId } },
    });
  }

  async findByWardCode(wardCode: string): Promise<Ward | null> {
    return this.repository.findOne({
      where: { wardCode },
    });
  }

  async update(id: number, updateWardDto: UpdateWardDto): Promise<Ward | null> {
    const updateData: {
      name?: string;
      wardCode?: string;
      lga?: { id: number };
    } = {};

    if (updateWardDto.name !== undefined) {
      updateData.name = updateWardDto.name;
    }
    if (updateWardDto.wardCode !== undefined) {
      updateData.wardCode = updateWardDto.wardCode;
    }
    if (updateWardDto.lgaId !== undefined) {
      updateData.lga = { id: updateWardDto.lgaId };
    }

    await this.repository.update({ id }, updateData);
    return this.findOne(id);
  }

  async remove(id: number): Promise<Ward | null> {
    const ward = await this.findOne(id);
    if (!ward) {
      return null;
    }
    return this.repository.remove(ward);
  }
}
