import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ElectoralOffice, OfficeCategory } from './electoral-office.entity';
import { ElectoralOfficeQueryDto } from './electoral-office.dto';
import { UserStatus } from '../../shared/enums/status.enum';

@Injectable()
export class ElectoralOfficeRepository {
  constructor(
    @InjectRepository(ElectoralOffice)
    private readonly repository: Repository<ElectoralOffice>,
  ) {}

  async create(data: Partial<ElectoralOffice>): Promise<ElectoralOffice> {
    const office = this.repository.create(data);
    return this.repository.save(office);
  }

  async findAll(queryDto?: ElectoralOfficeQueryDto): Promise<{
    data: ElectoralOffice[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const qb = this.repository
      .createQueryBuilder('office')
      .leftJoinAndSelect('office.state', 'state')
      .leftJoinAndSelect('office.lgas', 'lgas')
      .leftJoinAndSelect('office.wards', 'wards');

    if (queryDto?.search) {
      qb.andWhere('office.title ILIKE :search', {
        search: `%${queryDto.search}%`,
      });
    }

    if (queryDto?.category) {
      qb.andWhere('office.category = :category', {
        category: queryDto.category,
      });
    }

    if (queryDto?.stateId) {
      qb.andWhere('state.id = :stateId', {
        stateId: queryDto.stateId,
      });
    }

    if (queryDto?.status) {
      qb.andWhere('office.status = :status', {
        status: queryDto.status,
      });
    }

    const page = queryDto?.page || 1;
    const limit = queryDto?.limit || 20;
    const skip = (page - 1) * limit;

    qb.orderBy('office.title', 'ASC').skip(skip).take(limit);

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

  async findOne(id: number): Promise<ElectoralOffice | null> {
    return this.repository.findOne({
      where: { id },
      relations: {
        state: true,
        lgas: true,
        wards: true,
      },
    });
  }

  async findByCategory(
    category: OfficeCategory,
    status?: UserStatus,
  ): Promise<ElectoralOffice[]> {
    const whereCondition: { category: OfficeCategory; status?: UserStatus } = {
      category,
    };
    if (status !== undefined) {
      whereCondition.status = status;
    }

    return this.repository.find({
      where: whereCondition,
      relations: {
        state: true,
        lgas: true,
        wards: true,
      },
      order: { title: 'ASC' },
    });
  }

  async save(office: ElectoralOffice): Promise<ElectoralOffice> {
    return this.repository.save(office);
  }

  async remove(id: number): Promise<ElectoralOffice | null> {
    const office = await this.findOne(id);
    if (!office) {
      return null;
    }
    return this.repository.remove(office);
  }

  async count(status?: UserStatus): Promise<number> {
    if (status !== undefined) {
      return this.repository.count({ where: { status } });
    }
    return this.repository.count();
  }
}
