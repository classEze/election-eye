import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Aspirant } from './aspirant.entity';
import { AspirantQueryDto } from './aspirant.dto';

@Injectable()
export class AspirantRepository {
  constructor(
    @InjectRepository(Aspirant)
    private readonly repository: Repository<Aspirant>,
  ) {}

  async findAll(queryDto?: AspirantQueryDto): Promise<{
    data: Aspirant[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const qb = this.repository
      .createQueryBuilder('aspirant')
      .leftJoinAndSelect('aspirant.politicalParty', 'politicalParty')
      .leftJoinAndSelect('aspirant.electoralOffice', 'electoralOffice')
      .leftJoinAndSelect('electoralOffice.state', 'officeState')
      .leftJoinAndSelect('aspirant.accountUser', 'accountUser')
      .leftJoinAndSelect('accountUser.role', 'accountUserRole');

    if (queryDto?.search) {
      qb.andWhere(
        '(aspirant.firstName ILIKE :search OR aspirant.lastName ILIKE :search)',
        { search: `%${queryDto.search}%` },
      );
    }

    if (queryDto?.partyId) {
      qb.andWhere('politicalParty.id = :partyId', {
        partyId: queryDto.partyId,
      });
    }

    if (queryDto?.officeId) {
      qb.andWhere('electoralOffice.id = :officeId', {
        officeId: queryDto.officeId,
      });
    }

    if (queryDto?.isActive !== undefined) {
      qb.andWhere('aspirant.isActive = :isActive', {
        isActive: queryDto.isActive,
      });
    }

    const page = queryDto?.page || 1;
    const limit = queryDto?.limit || 20;
    const skip = (page - 1) * limit;

    qb.orderBy('aspirant.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findById(id: number): Promise<Aspirant | null> {
    return this.repository.findOne({
      where: { id },
      relations: {
        politicalParty: true,
        electoralOffice: true,
        accountUser: true,
      },
    });
  }

  async countAspirants(): Promise<{
    total: number;
    active: number;
    inactive: number;
  }> {
    const [total, active] = await Promise.all([
      this.repository.count(),
      this.repository.count({ where: { isActive: true } }),
    ]);

    return {
      total,
      active,
      inactive: total - active,
    };
  }
}
