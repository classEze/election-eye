import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { AuditLog } from './audit.entity';
import { AuditLogFilterDto, CreateAuditLogJobData } from './audit.dto';

@Injectable()
export class AuditRepository {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repository: Repository<AuditLog>,
  ) {}

  async create(data: CreateAuditLogJobData): Promise<AuditLog> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findById(id: number): Promise<AuditLog | null> {
    return this.repository.findOne({ where: { id } });
  }

  buildQuery(filters: AuditLogFilterDto): SelectQueryBuilder<AuditLog> {
    const qb = this.repository.createQueryBuilder('a');

    if (filters.actorId) {
      qb.andWhere('a.actor_id = :actorId', { actorId: filters.actorId });
    }

    if (filters.actorType) {
      qb.andWhere('a.actor_type = :actorType', {
        actorType: filters.actorType,
      });
    }

    if (filters.action) {
      qb.andWhere('a.action ILIKE :action', { action: `%${filters.action}%` });
    }

    if (filters.entityName) {
      qb.andWhere('a.entity_name = :entityName', {
        entityName: filters.entityName,
      });
    }

    if (filters.entityId) {
      qb.andWhere('a.entity_id = :entityId', { entityId: filters.entityId });
    }

    if (filters.status) {
      qb.andWhere('a.status = :status', { status: filters.status });
    }

    if (filters.startDate) {
      qb.andWhere('a.created_at >= :startDate', {
        startDate: new Date(filters.startDate),
      });
    }

    if (filters.endDate) {
      qb.andWhere('a.created_at <= :endDate', {
        endDate: new Date(filters.endDate),
      });
    }

    if (filters.search) {
      qb.andWhere(
        '(a.action ILIKE :search OR a.actor_email ILIKE :search OR a.entity_name ILIKE :search OR a.ip_address ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    qb.orderBy('a.created_at', 'DESC');
    return qb;
  }

  async findWithFilters(
    filters: AuditLogFilterDto,
  ): Promise<{ data: AuditLog[]; total: number; page: number; limit: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.buildQuery(filters);
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async streamWithFilters(filters: AuditLogFilterDto): Promise<AuditLog[]> {
    // Fetches full filtered dataset for export
    const qb = this.buildQuery(filters);
    return qb.getMany();
  }
}
