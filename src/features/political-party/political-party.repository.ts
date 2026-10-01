import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PoliticalParty } from './political-party.entity';
import {
  CreatePoliticalPartyDto,
  PoliticalPartyQueryDto,
  UpdatePoliticalPartyDto,
} from './political-party.dto';
import { UserStatus } from '../../shared/enums/status.enum';

@Injectable()
export class PoliticalPartyRepository {
  constructor(
    @InjectRepository(PoliticalParty)
    private readonly repository: Repository<PoliticalParty>,
  ) {}

  async findAll(queryDto?: PoliticalPartyQueryDto): Promise<PoliticalParty[]> {
    const qb = this.repository.createQueryBuilder('party');

    if (queryDto?.status) {
      qb.andWhere('party.status = :status', { status: queryDto.status });
    }

    if (queryDto?.search) {
      qb.andWhere('(party.name ILIKE :search OR party.code ILIKE :search)', {
        search: `%${queryDto.search}%`,
      });
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
      status: dto.status !== undefined ? dto.status : UserStatus.ACTIVE,
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
    if (dto.partyColorHex !== undefined)
      updateData.partyColorHex = dto.partyColorHex;
    if (dto.logoUrl !== undefined) updateData.logoUrl = dto.logoUrl;
    if (dto.status !== undefined) updateData.status = dto.status;

    await this.repository.update({ id }, updateData);
    return this.findById(id);
  }

  async updateLogo(
    id: number,
    logoUrl: string,
  ): Promise<PoliticalParty | null> {
    await this.repository.update({ id }, { logoUrl });
    return this.findById(id);
  }

  async softDelete(id: number): Promise<boolean> {
    // Mark status inactive and set deleted_at timestamp
    await this.repository.update({ id }, { status: UserStatus.INACTIVE });
    const result = await this.repository.softDelete(id);
    return (result.affected || 0) > 0;
  }

  async count(status?: UserStatus): Promise<number> {
    if (status !== undefined) {
      return this.repository.count({ where: { status } });
    }
    return this.repository.count();
  }
}
