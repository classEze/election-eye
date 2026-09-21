import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PoliticalParty } from './political-party.entity';
import {
  CreatePoliticalPartyDto,
  PoliticalPartyQueryDto,
  UpdatePoliticalPartyDto,
} from './political-party.dto';

@Injectable()
export class PoliticalPartyRepository {
  constructor(
    @InjectRepository(PoliticalParty)
    private readonly repository: Repository<PoliticalParty>,
  ) {}

  async findAll(queryDto?: PoliticalPartyQueryDto): Promise<PoliticalParty[]> {
    const qb = this.repository.createQueryBuilder('party');

    // Handle is_active / isActive query param
    const activeFilter =
      queryDto?.is_active !== undefined
        ? queryDto.is_active
        : queryDto?.isActive !== undefined
          ? queryDto.isActive
          : undefined;

    if (activeFilter !== undefined) {
      qb.andWhere('party.is_active = :isActive', { isActive: activeFilter });
    }

    if (queryDto?.search) {
      qb.andWhere(
        '(party.name ILIKE :search OR party.code ILIKE :search)',
        { search: `%${queryDto.search}%` },
      );
    }

    qb.orderBy('party.name', 'ASC');

    return qb.getMany();
  }

  async findById(
    id: number,
    includeDeleted = false,
  ): Promise<PoliticalParty | null> {
    return this.repository.findOne({
      where: { id },
      withDeleted: includeDeleted,
      relations: { aspirants: true },
    });
  }

  async findByCode(
    code: string,
    includeDeleted = false,
  ): Promise<PoliticalParty | null> {
    return this.repository.findOne({
      where: { code: code.toUpperCase() },
      withDeleted: includeDeleted,
    });
  }

  async create(
    dto: CreatePoliticalPartyDto,
    logoUrl?: string,
  ): Promise<PoliticalParty> {
    const entity = this.repository.create({
      name: dto.name,
      code: dto.code.toUpperCase(),
      partyColorHex: dto.partyColorHex ?? null,
      logoUrl: logoUrl ?? dto.logoUrl ?? null,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });
    return this.repository.save(entity);
  }

  async update(
    id: number,
    dto: UpdatePoliticalPartyDto,
  ): Promise<PoliticalParty | null> {
    const updateData: Partial<PoliticalParty> = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.code !== undefined) updateData.code = dto.code.toUpperCase();
    if (dto.partyColorHex !== undefined) updateData.partyColorHex = dto.partyColorHex;
    if (dto.logoUrl !== undefined) updateData.logoUrl = dto.logoUrl;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    await this.repository.update({ id }, updateData);
    return this.findById(id);
  }

  async updateLogo(id: number, logoUrl: string): Promise<PoliticalParty | null> {
    await this.repository.update({ id }, { logoUrl });
    return this.findById(id);
  }

  async softDelete(id: number): Promise<boolean> {
    // Mark isActive false and set deleted_at timestamp
    await this.repository.update({ id }, { isActive: false });
    const result = await this.repository.softDelete(id);
    return (result.affected || 0) > 0;
  }
}
