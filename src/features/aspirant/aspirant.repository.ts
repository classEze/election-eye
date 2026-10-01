import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Aspirant } from './aspirant.entity';
import { AspirantQueryDto } from './aspirant.dto';
import { UserStatus } from 'src/shared/enums/status.enum';

export interface AspirantStatsRaw {
  total: number;
  active: number;
  pending: number;
  inactive: number;
  deleted: number;
}

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

    if (queryDto?.status !== undefined) {
      qb.andWhere('accountUser.status = :status', {
        status: queryDto.status,
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

  async getStats(): Promise<AspirantStatsRaw> {
    const raw = await this.repository
      .createQueryBuilder('aspirant')
      .leftJoin('aspirant.accountUser', 'accountUser')
      .select('COUNT(aspirant.id)::int', 'total')
      .addSelect(
        'COUNT(aspirant.id) FILTER (WHERE accountUser.status = :active AND accountUser.deleted_at IS NULL)::int',
        'active',
      )
      .addSelect(
        'COUNT(aspirant.id) FILTER (WHERE accountUser.status = :pending AND accountUser.deleted_at IS NULL)::int',
        'pending',
      )
      .addSelect(
        'COUNT(aspirant.id) FILTER (WHERE accountUser.status = :inactive AND accountUser.deleted_at IS NULL)::int',
        'inactive',
      )
      .addSelect(
        'COUNT(aspirant.id) FILTER (WHERE accountUser.deleted_at IS NOT NULL)::int',
        'deleted',
      )
      .setParameters({
        active: UserStatus.ACTIVE,
        pending: UserStatus.PENDING,
        inactive: UserStatus.INACTIVE,
      })
      .getRawOne<AspirantStatsRaw>();

    return {
      total: Number(raw?.total || 0),
      active: Number(raw?.active || 0),
      pending: Number(raw?.pending || 0),
      inactive: Number(raw?.inactive || 0),
      deleted: Number(raw?.deleted || 0),
    };
  }

  async countAspirants(): Promise<{
    total: number;
    active: number;
    inactive: number;
  }> {
    const raw = await this.repository
      .createQueryBuilder('aspirant')
      .leftJoin('aspirant.accountUser', 'accountUser')
      .select('COUNT(aspirant.id)::int', 'total')
      .addSelect(
        'COUNT(aspirant.id) FILTER (WHERE accountUser.status = :active AND accountUser.deleted_at IS NULL)::int',
        'active',
      )
      .addSelect(
        'COUNT(aspirant.id) FILTER (WHERE accountUser.status = :inactive AND accountUser.deleted_at IS NULL)::int',
        'inactive',
      )
      .setParameters({
        active: UserStatus.ACTIVE,
        inactive: UserStatus.INACTIVE,
      })
      .getRawOne<{ total: number; active: number; inactive: number }>();

    return {
      total: Number(raw?.total || 0),
      active: Number(raw?.active || 0),
      inactive: Number(raw?.inactive || 0),
    };
  }
}
