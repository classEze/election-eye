import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incident, IncidentStatus } from './incident.entity';
import {
  CreateIncidentDto,
  IncidentFilterDto,
  IncidentMapClusterQueryDto,
} from './incident.dto';
import { User } from '../user/user.entity';

@Injectable()
export class IncidentRepository {
  constructor(
    @InjectRepository(Incident)
    private readonly repository: Repository<Incident>,
  ) {}

  async create(
    dto: CreateIncidentDto,
    user: User,
    mediaVideoUrls: string[] = [],
    mediaPictureUrls: string[] = [],
  ): Promise<Incident> {
    const incident = this.repository.create({
      category: { id: dto.categoryId },
      description: dto.description,
      severityLevel: dto.severityLevel,
      pollingUnit: dto.pollingUnitId ? { id: dto.pollingUnitId } : null,
      geolocationLat: dto.geolocationLat ?? null,
      geolocationLng: dto.geolocationLng ?? null,
      mediaVideoUrls,
      mediaPictureUrls,
      reportedByUser: user,
      status: IncidentStatus.REPORTED,
    });

    const saved = await this.repository.save(incident);
    return this.findById(saved.id) as Promise<Incident>;
  }

  async findById(id: number): Promise<Incident | null> {
    return this.repository.findOne({
      where: { id },
      relations: {
        category: true,
        pollingUnit: { ward: { lga: { state: true } } },
        reportedByUser: { role: true },
      },
    });
  }

  async findAll(
    filters: IncidentFilterDto,
  ): Promise<{ data: Incident[]; total: number; page: number; limit: number }> {
    const qb = this.repository
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.category', 'cat')
      .leftJoinAndSelect('i.pollingUnit', 'pu')
      .leftJoinAndSelect('pu.ward', 'ward')
      .leftJoinAndSelect('ward.lga', 'lga')
      .leftJoinAndSelect('lga.state', 'state')
      .leftJoinAndSelect('i.reportedByUser', 'user')
      .leftJoinAndSelect('user.role', 'role');

    if (filters.categoryId) {
      qb.andWhere('i.category_id = :catId', { catId: filters.categoryId });
    }

    if (filters.severityLevel) {
      qb.andWhere('i.severity_level = :severity', {
        severity: filters.severityLevel,
      });
    }

    if (filters.status) {
      qb.andWhere('i.status = :status', { status: filters.status });
    }

    if (filters.pollingUnitId) {
      qb.andWhere('i.polling_unit_id = :puId', { puId: filters.pollingUnitId });
    }

    if (filters.wardId) {
      qb.andWhere('pu.ward_id = :wardId', { wardId: filters.wardId });
    }

    if (filters.lgaId) {
      qb.andWhere('ward.lga_id = :lgaId', { lgaId: filters.lgaId });
    }

    if (filters.stateId) {
      qb.andWhere('lga.state_id = :stateId', { stateId: filters.stateId });
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    qb.orderBy('i.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  // Get all incidents for a specific electoral office jurisdiction
  async findByElectoralOffice(
    officeId: number,
    page = 1,
    limit = 20,
  ): Promise<{ data: Incident[]; total: number; page: number; limit: number }> {
    const qb = this.repository
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.category', 'cat')
      .innerJoinAndSelect('i.pollingUnit', 'pu')
      .innerJoinAndSelect('pu.ward', 'ward')
      .innerJoinAndSelect('ward.lga', 'lga')
      .leftJoinAndSelect('i.reportedByUser', 'user')
      .where((subQb) => {
        // Match either by office_lgas or office_wards
        const subQueryLga = subQb
          .subQuery()
          .select('ol.lga_id')
          .from('office_lgas', 'ol')
          .where('ol.office_id = :officeId')
          .getQuery();

        const subQueryWard = subQb
          .subQuery()
          .select('ow.ward_id')
          .from('office_wards', 'ow')
          .where('ow.office_id = :officeId')
          .getQuery();

        return `(ward.lga_id IN ${subQueryLga} OR pu.ward_id IN ${subQueryWard})`;
      })
      .setParameter('officeId', officeId);

    const total = await qb.getCount();
    const skip = (page - 1) * limit;

    const data = await qb
      .orderBy('i.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    return { data, total, page, limit };
  }

  // Geolocation bounding-box spatial query taking advantage of idx_incidents_geolocation
  async findMapClusters(query: IncidentMapClusterQueryDto): Promise<Incident[]> {
    return this.repository
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.category', 'cat')
      .leftJoinAndSelect('i.pollingUnit', 'pu')
      .where(
        'i.geolocation_lat BETWEEN :minLat AND :maxLat AND i.geolocation_lng BETWEEN :minLng AND :maxLng',
        {
          minLat: query.minLat,
          maxLat: query.maxLat,
          minLng: query.minLng,
          maxLng: query.maxLng,
        },
      )
      .orderBy('i.createdAt', 'DESC')
      .getMany();
  }

  async updateStatus(id: number, status: IncidentStatus): Promise<Incident | null> {
    await this.repository.update({ id }, { status });
    return this.findById(id);
  }

  async remove(id: number): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return (result.affected || 0) > 0;
  }
}
