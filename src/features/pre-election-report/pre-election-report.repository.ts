import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PreElectionReport } from './pre-election-report.entity';
import {
  PreElectionReportFilterDto,
  PreElectionReportSummary,
  PaginatedPreElectionReportsResponse,
} from './pre-election-report.dto';
import { MaterialsArrivedStatus } from './materials-arrived.enum';

@Injectable()
export class PreElectionReportRepository {
  constructor(
    @InjectRepository(PreElectionReport)
    private readonly repository: Repository<PreElectionReport>,
  ) {}

  async findByPollingUnitAndOffice(
    pollingUnitId: number,
    electoralOfficeId: number,
    aspirantId?: number,
  ): Promise<PreElectionReport | null> {
    const whereCondition: any = {
      pollingUnit: { id: pollingUnitId },
      electoralOffice: { id: electoralOfficeId },
    };
    if (aspirantId) {
      whereCondition.aspirant = { id: aspirantId };
    }

    return this.repository.findOne({
      where: whereCondition,
      relations: {
        pollingUnit: { ward: { lga: { state: true } } },
        electoralOffice: true,
        uploadedByUser: true,
        politicalParty: true,
        aspirant: true,
      },
    });
  }

  async findById(id: number): Promise<PreElectionReport | null> {
    return this.repository.findOne({
      where: { id },
      relations: {
        pollingUnit: { ward: { lga: { state: true } } },
        electoralOffice: true,
        uploadedByUser: true,
        politicalParty: true,
        aspirant: true,
      },
    });
  }

  async createOrUpdate(
    reportData: Partial<PreElectionReport>,
  ): Promise<PreElectionReport> {
    const puId = reportData.pollingUnit?.id;
    const officeId = reportData.electoralOffice?.id;
    const aspirantId = reportData.aspirant?.id;

    if (puId && officeId) {
      const whereCondition: any = {
        pollingUnit: { id: puId },
        electoralOffice: { id: officeId },
      };
      if (aspirantId) {
        whereCondition.aspirant = { id: aspirantId };
      }

      const existing = await this.repository.findOne({
        where: whereCondition,
      });

      if (existing) {
        await this.repository.update(existing.id, {
          materialsArrived: reportData.materialsArrived ?? existing.materialsArrived,
          materialArrivalTime:
            reportData.materialArrivalTime !== undefined
              ? reportData.materialArrivalTime
              : existing.materialArrivalTime,
          totalRegisteredVoters:
            reportData.totalRegisteredVoters !== undefined
              ? reportData.totalRegisteredVoters
              : existing.totalRegisteredVoters,
          totalAccreditedVoters:
            reportData.totalAccreditedVoters !== undefined
              ? reportData.totalAccreditedVoters
              : existing.totalAccreditedVoters,
          comments:
            reportData.comments !== undefined
              ? reportData.comments
              : existing.comments,
          mediaPictureUrls:
            reportData.mediaPictureUrls !== undefined
              ? reportData.mediaPictureUrls
              : existing.mediaPictureUrls,
          mediaVideoUrls:
            reportData.mediaVideoUrls !== undefined
              ? reportData.mediaVideoUrls
              : existing.mediaVideoUrls,
          uploadedByUser: reportData.uploadedByUser ?? existing.uploadedByUser,
          politicalParty: reportData.politicalParty ?? existing.politicalParty,
          aspirant: reportData.aspirant ?? existing.aspirant,
          clientSubmittedAt:
            reportData.clientSubmittedAt ?? existing.clientSubmittedAt,
        });

        return (await this.findById(existing.id))!;
      }
    }

    const created = this.repository.create(reportData);
    const saved = await this.repository.save(created);
    return (await this.findById(saved.id))!;
  }

  async findAll(
    filters: PreElectionReportFilterDto,
    aspirantId?: number,
  ): Promise<PaginatedPreElectionReportsResponse> {
    const qb = this.repository
      .createQueryBuilder('per')
      .leftJoinAndSelect('per.electoralOffice', 'office')
      .leftJoinAndSelect('per.pollingUnit', 'pu')
      .leftJoinAndSelect('pu.ward', 'ward')
      .leftJoinAndSelect('ward.lga', 'lga')
      .leftJoinAndSelect('lga.state', 'state')
      .leftJoinAndSelect('per.uploadedByUser', 'uploader')
      .leftJoinAndSelect('per.politicalParty', 'party')
      .leftJoinAndSelect('per.aspirant', 'aspirant');

    const effectiveAspirantId = aspirantId ?? filters.aspirantId;
    if (effectiveAspirantId) {
      qb.andWhere(
        '(per.aspirant_id = :aspirantId OR uploader.aspirant_id = :aspirantId)',
        { aspirantId: effectiveAspirantId },
      );
    }

    if (filters.politicalPartyId) {
      qb.andWhere('per.political_party_id = :politicalPartyId', {
        politicalPartyId: filters.politicalPartyId,
      });
    }

    if (filters.materialsArrived !== undefined) {
      qb.andWhere('per.materials_arrived = :materialsArrived', {
        materialsArrived: filters.materialsArrived,
      });
    }

    if (filters.electoralOfficeId) {
      qb.andWhere('per.electoral_office_id = :officeId', {
        officeId: filters.electoralOfficeId,
      });
    }

    if (filters.pollingUnitId) {
      qb.andWhere('per.polling_unit_id = :puId', {
        puId: filters.pollingUnitId,
      });
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

    qb.orderBy('per.serverReceivedAt', 'DESC').skip(skip).take(limit);

    // Lean summary aggregation query sharing the identical filter conditions
    const summaryQb = this.repository
      .createQueryBuilder('per')
      .leftJoin('per.pollingUnit', 'pu')
      .leftJoin('pu.ward', 'ward')
      .leftJoin('ward.lga', 'lga')
      .leftJoin('per.uploadedByUser', 'uploader');

    if (effectiveAspirantId) {
      summaryQb.andWhere(
        '(per.aspirant_id = :aspirantId OR uploader.aspirant_id = :aspirantId)',
        { aspirantId: effectiveAspirantId },
      );
    }

    if (filters.politicalPartyId) {
      summaryQb.andWhere('per.political_party_id = :politicalPartyId', {
        politicalPartyId: filters.politicalPartyId,
      });
    }

    if (filters.materialsArrived !== undefined) {
      summaryQb.andWhere('per.materials_arrived = :materialsArrived', {
        materialsArrived: filters.materialsArrived,
      });
    }

    if (filters.electoralOfficeId) {
      summaryQb.andWhere('per.electoral_office_id = :officeId', {
        officeId: filters.electoralOfficeId,
      });
    }

    if (filters.pollingUnitId) {
      summaryQb.andWhere('per.polling_unit_id = :puId', {
        puId: filters.pollingUnitId,
      });
    }

    if (filters.wardId) {
      summaryQb.andWhere('pu.ward_id = :wardId', { wardId: filters.wardId });
    }

    if (filters.lgaId) {
      summaryQb.andWhere('ward.lga_id = :lgaId', { lgaId: filters.lgaId });
    }

    if (filters.stateId) {
      summaryQb.andWhere('lga.state_id = :stateId', { stateId: filters.stateId });
    }

    summaryQb
      .select([
        'COUNT(per.id)::int AS "totalReports"',
        'COUNT(CASE WHEN per.materials_arrived = :fullStatus THEN 1 END)::int AS "materialsFullCount"',
        'COUNT(CASE WHEN per.materials_arrived = :partialStatus THEN 1 END)::int AS "materialsPartialCount"',
        'COUNT(CASE WHEN per.materials_arrived = :noneStatus THEN 1 END)::int AS "materialsNoneCount"',
        'COALESCE(SUM(per.total_registered_voters), 0)::int AS "totalRegisteredVoters"',
        'COALESCE(SUM(per.total_accredited_voters), 0)::int AS "totalAccreditedVoters"',
      ])
      .setParameters({
        fullStatus: MaterialsArrivedStatus.FULL,
        partialStatus: MaterialsArrivedStatus.PARTIAL,
        noneStatus: MaterialsArrivedStatus.NONE,
      });

    const [[data, total], summaryRaw] = await Promise.all([
      qb.getManyAndCount(),
      summaryQb.getRawOne<{
        totalReports: number | string;
        materialsFullCount: number | string;
        materialsPartialCount: number | string;
        materialsNoneCount: number | string;
        totalRegisteredVoters: number | string;
        totalAccreditedVoters: number | string;
      }>(),
    ]);

    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

    const summary: PreElectionReportSummary = {
      totalReports: Number(summaryRaw?.totalReports ?? 0),
      materialsFullCount: Number(summaryRaw?.materialsFullCount ?? 0),
      materialsPartialCount: Number(summaryRaw?.materialsPartialCount ?? 0),
      materialsNoneCount: Number(summaryRaw?.materialsNoneCount ?? 0),
      totalRegisteredVoters: Number(summaryRaw?.totalRegisteredVoters ?? 0),
      totalAccreditedVoters: Number(summaryRaw?.totalAccreditedVoters ?? 0),
    };

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      summary,
    };
  }
}

