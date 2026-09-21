import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Result, ResultAuditStatus } from './result.entity';
import { ResultDetail } from '../result-detail/result-detail.entity';
import { ResultFilterDto } from './result.dto';
import { User } from '../user/user.entity';

@Injectable()
export class ResultRepository {
  constructor(
    @InjectRepository(Result)
    private readonly repository: Repository<Result>,
    @InjectRepository(ResultDetail)
    private readonly resultDetailRepository: Repository<ResultDetail>,
    private readonly dataSource: DataSource,
  ) {}

  async createTransactional(
    resultData: Partial<Result>,
    partyBreakdown: { politicalPartyId: number; votes: number }[],
  ): Promise<Result> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const resultEntity = manager.create(Result, resultData);
      const savedResult = await manager.save(Result, resultEntity);

      const detailEntities = partyBreakdown.map((item) =>
        manager.create(ResultDetail, {
          result: savedResult,
          politicalParty: { id: item.politicalPartyId },
          votes: item.votes,
        }),
      );

      await manager.save(ResultDetail, detailEntities);

      return this.findById(savedResult.id, manager) as Promise<Result>;
    });
  }

  async findById(
    id: number,
    manager?: EntityManager,
  ): Promise<Result | null> {
    const repo = manager ? manager.getRepository(Result) : this.repository;
    return repo.findOne({
      where: { id },
      relations: {
        electoralOffice: { state: true },
        pollingUnit: { ward: { lga: { state: true } } },
        uploadedByUser: { role: true },
        verifiedByUser: { role: true },
        aspirant: true,
        partyBreakdown: { politicalParty: true },
      },
    });
  }

  async findByPollingUnitAndOffice(
    pollingUnitId: number,
    electoralOfficeId: number,
  ): Promise<Result | null> {
    return this.repository.findOne({
      where: {
        pollingUnit: { id: pollingUnitId },
        electoralOffice: { id: electoralOfficeId },
      },
      relations: {
        partyBreakdown: { politicalParty: true },
      },
    });
  }

  async findByPollingUnit(pollingUnitId: number): Promise<Result[]> {
    return this.repository.find({
      where: { pollingUnit: { id: pollingUnitId } },
      relations: {
        electoralOffice: true,
        partyBreakdown: { politicalParty: true },
        uploadedByUser: true,
      },
      order: { serverReceivedAt: 'DESC' },
    });
  }

  async findAll(
    filters: ResultFilterDto,
  ): Promise<{ data: Result[]; total: number; page: number; limit: number }> {
    const qb = this.repository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.electoralOffice', 'office')
      .leftJoinAndSelect('r.pollingUnit', 'pu')
      .leftJoinAndSelect('pu.ward', 'ward')
      .leftJoinAndSelect('ward.lga', 'lga')
      .leftJoinAndSelect('r.uploadedByUser', 'uploader')
      .leftJoinAndSelect('r.verifiedByUser', 'verifier')
      .leftJoinAndSelect('r.partyBreakdown', 'breakdown')
      .leftJoinAndSelect('breakdown.politicalParty', 'party');

    if (filters.electoralOfficeId) {
      qb.andWhere('r.electoral_office_id = :officeId', {
        officeId: filters.electoralOfficeId,
      });
    }

    if (filters.pollingUnitId) {
      qb.andWhere('r.polling_unit_id = :puId', {
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

    if (filters.isVerified !== undefined) {
      qb.andWhere('r.is_verified = :isVerified', {
        isVerified: filters.isVerified,
      });
    }

    if (filters.auditStatus) {
      qb.andWhere('r.audit_status = :auditStatus', {
        auditStatus: filters.auditStatus,
      });
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    qb.orderBy('r.serverReceivedAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }

  async updateAuditStatus(
    id: number,
    auditStatus: ResultAuditStatus,
    verifier: User,
    rejectionReason?: string,
  ): Promise<Result | null> {
    const isVerified = auditStatus === ResultAuditStatus.VERIFIED;
    await this.repository.update(
      { id },
      {
        auditStatus,
        isVerified,
        rejectionReason: auditStatus === ResultAuditStatus.REJECTED || auditStatus === ResultAuditStatus.FLAGGED ? rejectionReason : null,
        verifiedByUser: verifier,
      },
    );
    return this.findById(id);
  }

  // Aggregate party totals across an entire electoral office
  async getOfficePartySummary(officeId: number): Promise<any[]> {
    return this.resultDetailRepository
      .createQueryBuilder('rd')
      .innerJoin('rd.result', 'r')
      .innerJoin('rd.politicalParty', 'party')
      .select('party.id', 'partyId')
      .addSelect('party.name', 'partyName')
      .addSelect('party.party_acronym', 'partyAcronym')
      .addSelect('party.logo_url', 'logoUrl')
      .addSelect('COALESCE(SUM(rd.votes), 0)::int', 'totalVotes')
      .where('r.electoral_office_id = :officeId', { officeId })
      .groupBy('party.id')
      .addGroupBy('party.name')
      .addGroupBy('party.party_acronym')
      .addGroupBy('party.logo_url')
      .orderBy('SUM(rd.votes)', 'DESC')
      .getRawMany();
  }

  // Report: Electoral office result aggregated for a specific Ward
  async getOfficeWardReport(officeId: number, wardId: number): Promise<any> {
    const partyBreakdown = await this.resultDetailRepository
      .createQueryBuilder('rd')
      .innerJoin('rd.result', 'r')
      .innerJoin('r.pollingUnit', 'pu')
      .innerJoin('rd.politicalParty', 'party')
      .select('party.id', 'partyId')
      .addSelect('party.name', 'partyName')
      .addSelect('party.party_acronym', 'partyAcronym')
      .addSelect('COALESCE(SUM(rd.votes), 0)::int', 'totalVotes')
      .where('r.electoral_office_id = :officeId', { officeId })
      .andWhere('pu.ward_id = :wardId', { wardId })
      .groupBy('party.id')
      .addGroupBy('party.name')
      .addGroupBy('party.party_acronym')
      .orderBy('SUM(rd.votes)', 'DESC')
      .getRawMany();

    const totals = await this.repository
      .createQueryBuilder('r')
      .innerJoin('r.pollingUnit', 'pu')
      .select('COALESCE(SUM(r.total_valid_votes), 0)::int', 'totalValidVotes')
      .addSelect('COALESCE(SUM(r.rejected_votes), 0)::int', 'totalRejectedVotes')
      .addSelect('COALESCE(SUM(r.total_accredited_voters), 0)::int', 'totalAccreditedVoters')
      .addSelect('COALESCE(SUM(r.total_registered_voters), 0)::int', 'totalRegisteredVoters')
      .addSelect('COUNT(DISTINCT r.id)::int', 'totalResultsUploaded')
      .where('r.electoral_office_id = :officeId', { officeId })
      .andWhere('pu.ward_id = :wardId', { wardId })
      .getRawOne();

    return {
      officeId,
      wardId,
      totals,
      partyBreakdown,
    };
  }

  // Report: Electoral office result aggregated for a specific LGA
  async getOfficeLgaReport(officeId: number, lgaId: number): Promise<any> {
    const partyBreakdown = await this.resultDetailRepository
      .createQueryBuilder('rd')
      .innerJoin('rd.result', 'r')
      .innerJoin('r.pollingUnit', 'pu')
      .innerJoin('pu.ward', 'ward')
      .innerJoin('rd.politicalParty', 'party')
      .select('party.id', 'partyId')
      .addSelect('party.name', 'partyName')
      .addSelect('party.party_acronym', 'partyAcronym')
      .addSelect('COALESCE(SUM(rd.votes), 0)::int', 'totalVotes')
      .where('r.electoral_office_id = :officeId', { officeId })
      .andWhere('ward.lga_id = :lgaId', { lgaId })
      .groupBy('party.id')
      .addGroupBy('party.name')
      .addGroupBy('party.party_acronym')
      .orderBy('SUM(rd.votes)', 'DESC')
      .getRawMany();

    const totals = await this.repository
      .createQueryBuilder('r')
      .innerJoin('r.pollingUnit', 'pu')
      .innerJoin('pu.ward', 'ward')
      .select('COALESCE(SUM(r.total_valid_votes), 0)::int', 'totalValidVotes')
      .addSelect('COALESCE(SUM(r.rejected_votes), 0)::int', 'totalRejectedVotes')
      .addSelect('COALESCE(SUM(r.total_accredited_voters), 0)::int', 'totalAccreditedVoters')
      .addSelect('COALESCE(SUM(r.total_registered_voters), 0)::int', 'totalRegisteredVoters')
      .addSelect('COUNT(DISTINCT r.id)::int', 'totalResultsUploaded')
      .where('r.electoral_office_id = :officeId', { officeId })
      .andWhere('ward.lga_id = :lgaId', { lgaId })
      .getRawOne();

    return {
      officeId,
      lgaId,
      totals,
      partyBreakdown,
    };
  }

  // Report: Electoral office result aggregated for a specific State
  async getOfficeStateReport(officeId: number, stateId: number): Promise<any> {
    const partyBreakdown = await this.resultDetailRepository
      .createQueryBuilder('rd')
      .innerJoin('rd.result', 'r')
      .innerJoin('r.pollingUnit', 'pu')
      .innerJoin('pu.ward', 'ward')
      .innerJoin('ward.lga', 'lga')
      .innerJoin('rd.politicalParty', 'party')
      .select('party.id', 'partyId')
      .addSelect('party.name', 'partyName')
      .addSelect('party.party_acronym', 'partyAcronym')
      .addSelect('COALESCE(SUM(rd.votes), 0)::int', 'totalVotes')
      .where('r.electoral_office_id = :officeId', { officeId })
      .andWhere('lga.state_id = :stateId', { stateId })
      .groupBy('party.id')
      .addGroupBy('party.name')
      .addGroupBy('party.party_acronym')
      .orderBy('SUM(rd.votes)', 'DESC')
      .getRawMany();

    const totals = await this.repository
      .createQueryBuilder('r')
      .innerJoin('r.pollingUnit', 'pu')
      .innerJoin('pu.ward', 'ward')
      .innerJoin('ward.lga', 'lga')
      .select('COALESCE(SUM(r.total_valid_votes), 0)::int', 'totalValidVotes')
      .addSelect('COALESCE(SUM(r.rejected_votes), 0)::int', 'totalRejectedVotes')
      .addSelect('COALESCE(SUM(r.total_accredited_voters), 0)::int', 'totalAccreditedVoters')
      .addSelect('COALESCE(SUM(r.total_registered_voters), 0)::int', 'totalRegisteredVoters')
      .addSelect('COUNT(DISTINCT r.id)::int', 'totalResultsUploaded')
      .where('r.electoral_office_id = :officeId', { officeId })
      .andWhere('lga.state_id = :stateId', { stateId })
      .getRawOne();

    return {
      officeId,
      stateId,
      totals,
      partyBreakdown,
    };
  }

  // Upload progress stats for an electoral office
  async getOfficeUploadProgress(officeId: number): Promise<any> {
    const stats = await this.repository.manager.query(
      `
      SELECT 
        (
          SELECT COUNT(DISTINCT pu.id) 
          FROM polling_units pu
          JOIN wards w ON w.id = pu.ward_id
          JOIN office_lgas ol ON ol.lga_id = w.lga_id
          WHERE ol.office_id = $1
        )::int AS total_polling_units,
        COUNT(DISTINCT r.polling_unit_id)::int AS uploaded_polling_units,
        COALESCE(SUM(r.total_valid_votes), 0)::int AS total_valid_votes,
        COALESCE(SUM(r.rejected_votes), 0)::int AS total_rejected_votes,
        COALESCE(SUM(r.total_accredited_voters), 0)::int AS total_accredited_voters,
        COALESCE(SUM(r.total_registered_voters), 0)::int AS total_registered_voters
      FROM results r
      WHERE r.electoral_office_id = $1
      `,
      [officeId],
    );

    const row = stats[0] || {};
    const totalPus = row.total_polling_units || 0;
    const uploadedPus = row.uploaded_polling_units || 0;
    const percentage = totalPus > 0 ? Number(((uploadedPus / totalPus) * 100).toFixed(2)) : 0;

    return {
      officeId,
      totalPollingUnits: totalPus,
      uploadedPollingUnits: uploadedPus,
      completionPercentage: percentage,
      totalValidVotes: row.total_valid_votes || 0,
      totalRejectedVotes: row.total_rejected_votes || 0,
      totalAccreditedVoters: row.total_accredited_voters || 0,
      totalRegisteredVoters: row.total_registered_voters || 0,
    };
  }

  // Paginated EC8A form URLs with PU details
  async getOfficeEc8aForms(
    officeId: number,
    page = 1,
    limit = 20,
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const qb = this.repository
      .createQueryBuilder('r')
      .innerJoin('r.pollingUnit', 'pu')
      .innerJoin('pu.ward', 'ward')
      .innerJoin('ward.lga', 'lga')
      .select('r.id', 'resultId')
      .addSelect('r.ec8a_photo_url', 'ec8aPhotoUrl')
      .addSelect('r.total_valid_votes', 'totalValidVotes')
      .addSelect('r.rejected_votes', 'rejectedVotes')
      .addSelect('r.is_verified', 'isVerified')
      .addSelect('r.audit_status', 'auditStatus')
      .addSelect('r.server_received_at', 'serverReceivedAt')
      .addSelect('pu.id', 'pollingUnitId')
      .addSelect('pu.name', 'pollingUnitName')
      .addSelect('pu.pu_code', 'puCode')
      .addSelect('ward.id', 'wardId')
      .addSelect('ward.name', 'wardName')
      .addSelect('lga.id', 'lgaId')
      .addSelect('lga.name', 'lgaName')
      .where('r.electoral_office_id = :officeId', { officeId });

    const total = await qb.getCount();
    const skip = (page - 1) * limit;

    const data = await qb
      .orderBy('r.server_received_at', 'DESC')
      .offset(skip)
      .limit(limit)
      .getRawMany();

    return { data, total, page, limit };
  }
}
