import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PreElectionReport } from './pre-election-report.entity';
import { PreElectionReportFilterDto } from './pre-election-report.dto';

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
  ): Promise<{ data: PreElectionReport[]; total: number; page: number; limit: number }> {
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

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }
}
