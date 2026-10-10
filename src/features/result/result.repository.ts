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

  async updateTransactional(
    id: number,
    resultData: Partial<Result>,
    partyBreakdown: { politicalPartyId: number; votes: number }[],
  ): Promise<Result> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      await manager.update(Result, { id }, resultData);

      // Replace party breakdown details
      await manager.delete(ResultDetail, { result: { id } });

      const detailEntities = partyBreakdown.map((item) =>
        manager.create(ResultDetail, {
          result: { id } as Result,
          politicalParty: { id: item.politicalPartyId },
          votes: item.votes,
        }),
      );

      await manager.save(ResultDetail, detailEntities);

      return this.findById(id, manager) as Promise<Result>;
    });
  }

  async findById(id: number, manager?: EntityManager): Promise<Result | null> {
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

  async findByPollingUnitOfficeAndParty(
    pollingUnitId: number,
    electoralOfficeId: number,
    politicalPartyId: number,
  ): Promise<Result | null> {
    return this.repository.findOne({
      where: {
        pollingUnit: { id: pollingUnitId },
        electoralOffice: { id: electoralOfficeId },
        politicalParty: { id: politicalPartyId },
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

    qb.orderBy('r.serverReceivedAt', 'DESC').skip(skip).take(limit);

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
        rejectionReason:
          auditStatus === ResultAuditStatus.REJECTED ||
          auditStatus === ResultAuditStatus.FLAGGED
            ? rejectionReason
            : null,
        verifiedByUser: verifier,
      },
    );
    return this.findById(id);
  }

  // Aggregate party totals across an entire electoral office (Approved results only)
  async getOfficePartySummary(officeId: number, partyId?: number): Promise<any[]> {
    const qb = this.resultDetailRepository
      .createQueryBuilder('rd')
      .innerJoin('rd.result', 'r')
      .innerJoin('rd.politicalParty', 'party')
      .select('party.id', 'partyId')
      .addSelect('party.name', 'partyName')
      .addSelect('party.party_acronym', 'partyAcronym')
      .addSelect('party.logo_url', 'logoUrl')
      .addSelect('COALESCE(SUM(rd.votes), 0)::int', 'totalVotes')
      .where('r.electoral_office_id = :officeId', { officeId })
      .andWhere('r.is_verified = true');

    if (partyId) {
      qb.andWhere('r.political_party_id = :partyId', { partyId });
    }

    return qb.groupBy('party.id')
      .addGroupBy('party.name')
      .addGroupBy('party.party_acronym')
      .addGroupBy('party.logo_url')
      .orderBy('SUM(rd.votes)', 'DESC')
      .getRawMany();
  }

  // Report: Electoral office result aggregated for a specific Polling Unit (Approved results only)
  async getOfficePollingUnitReport(officeId: number, puId: number, partyId?: number): Promise<any> {
    const rdQb = this.resultDetailRepository
      .createQueryBuilder('rd')
      .innerJoin('rd.result', 'r')
      .innerJoin('r.pollingUnit', 'pu')
      .innerJoin('rd.politicalParty', 'party')
      .select('party.id', 'partyId')
      .addSelect('party.name', 'partyName')
      .addSelect('party.party_acronym', 'partyAcronym')
      .addSelect('COALESCE(SUM(rd.votes), 0)::int', 'totalVotes')
      .where('r.electoral_office_id = :officeId', { officeId })
      .andWhere('pu.id = :puId', { puId })
      .andWhere('r.is_verified = true');
      
    if (partyId) rdQb.andWhere('r.political_party_id = :partyId', { partyId });

    const partyBreakdown = await rdQb
      .groupBy('party.id')
      .addGroupBy('party.name')
      .addGroupBy('party.party_acronym')
      .orderBy('SUM(rd.votes)', 'DESC')
      .getRawMany();

    const totalsQb = this.repository
      .createQueryBuilder('r')
      .innerJoin('r.pollingUnit', 'pu')
      .select('COALESCE(SUM(r.total_valid_votes), 0)::int', 'totalValidVotes')
      .addSelect('COALESCE(SUM(r.rejected_votes), 0)::int', 'totalRejectedVotes')
      .addSelect('COALESCE(SUM(r.total_accredited_voters), 0)::int', 'totalAccreditedVoters')
      .addSelect('COALESCE(SUM(r.total_registered_voters), 0)::int', 'totalRegisteredVoters')
      .addSelect('COUNT(DISTINCT r.id)::int', 'totalResultsUploaded')
      .where('r.electoral_office_id = :officeId', { officeId })
      .andWhere('pu.id = :puId', { puId })
      .andWhere('r.is_verified = true');
      
    if (partyId) totalsQb.andWhere('r.political_party_id = :partyId', { partyId });

    const totals = await totalsQb.getRawOne();

    return {
      officeId,
      puId,
      totals,
      partyBreakdown,
    };
  }

  // Report: Electoral office result aggregated for a specific Ward (Approved results only)
  async getOfficeWardReport(officeId: number, wardId: number, partyId?: number): Promise<any> {
    const rdQb = this.resultDetailRepository
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
      .andWhere('r.is_verified = true');
      
    if (partyId) rdQb.andWhere('r.political_party_id = :partyId', { partyId });

    const partyBreakdown = await rdQb
      .groupBy('party.id')
      .addGroupBy('party.name')
      .addGroupBy('party.party_acronym')
      .orderBy('SUM(rd.votes)', 'DESC')
      .getRawMany();

    const totalsQb = this.repository
      .createQueryBuilder('r')
      .innerJoin('r.pollingUnit', 'pu')
      .select('COALESCE(SUM(r.total_valid_votes), 0)::int', 'totalValidVotes')
      .addSelect('COALESCE(SUM(r.rejected_votes), 0)::int', 'totalRejectedVotes')
      .addSelect('COALESCE(SUM(r.total_accredited_voters), 0)::int', 'totalAccreditedVoters')
      .addSelect('COALESCE(SUM(r.total_registered_voters), 0)::int', 'totalRegisteredVoters')
      .addSelect('COUNT(DISTINCT r.id)::int', 'totalResultsUploaded')
      .where('r.electoral_office_id = :officeId', { officeId })
      .andWhere('pu.ward_id = :wardId', { wardId })
      .andWhere('r.is_verified = true');
      
    if (partyId) totalsQb.andWhere('r.political_party_id = :partyId', { partyId });

    const totals = await totalsQb.getRawOne();

    return {
      officeId,
      wardId,
      totals,
      partyBreakdown,
    };
  }

  // Report: Electoral office result aggregated for a specific LGA (Approved results only)
  async getOfficeLgaReport(officeId: number, lgaId: number, partyId?: number): Promise<any> {
    const rdQb = this.resultDetailRepository
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
      .andWhere('r.is_verified = true');
      
    if (partyId) rdQb.andWhere('r.political_party_id = :partyId', { partyId });

    const partyBreakdown = await rdQb
      .groupBy('party.id')
      .addGroupBy('party.name')
      .addGroupBy('party.party_acronym')
      .orderBy('SUM(rd.votes)', 'DESC')
      .getRawMany();

    const totalsQb = this.repository
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
      .andWhere('r.is_verified = true');
      
    if (partyId) totalsQb.andWhere('r.political_party_id = :partyId', { partyId });

    const totals = await totalsQb.getRawOne();

    return {
      officeId,
      lgaId,
      totals,
      partyBreakdown,
    };
  }

  // Report: Electoral office result aggregated for a specific State (Approved results only)
  async getOfficeStateReport(officeId: number, stateId: number, partyId?: number): Promise<any> {
    const rdQb = this.resultDetailRepository
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
      .andWhere('r.is_verified = true');
      
    if (partyId) rdQb.andWhere('r.political_party_id = :partyId', { partyId });

    const partyBreakdown = await rdQb
      .groupBy('party.id')
      .addGroupBy('party.name')
      .addGroupBy('party.party_acronym')
      .orderBy('SUM(rd.votes)', 'DESC')
      .getRawMany();

    const totalsQb = this.repository
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
      .andWhere('r.is_verified = true');
      
    if (partyId) totalsQb.andWhere('r.political_party_id = :partyId', { partyId });

    const totals = await totalsQb.getRawOne();

    return {
      officeId,
      stateId,
      totals,
      partyBreakdown,
    };
  }

  // Upload progress stats for an electoral office (Full pipeline: Submissions & Approvals)
  async getOfficeUploadProgress(officeId: number): Promise<{
    officeId: number;
    totalPollingUnits: number;
    submittedPollingUnits: number;
    submissionPercentage: number;
    approvedPollingUnits: number;
    approvalPercentage: number;
    pendingPollingUnits: number;
    flaggedPollingUnits: number;
    rejectedPollingUnits: number;
    approvedTotals: {
      totalValidVotes: number;
      totalRejectedVotes: number;
      totalAccreditedVoters: number;
      totalRegisteredVoters: number;
    };
    submittedTotals: {
      totalValidVotes: number;
      totalRejectedVotes: number;
      totalAccreditedVoters: number;
      totalRegisteredVoters: number;
    };
  }> {
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
        COUNT(DISTINCT r.polling_unit_id)::int AS submitted_polling_units,
        COUNT(DISTINCT CASE WHEN r.is_verified = true THEN r.polling_unit_id END)::int AS approved_polling_units,
        COUNT(DISTINCT CASE WHEN r.audit_status = 'PENDING' THEN r.polling_unit_id END)::int AS pending_polling_units,
        COUNT(DISTINCT CASE WHEN r.audit_status = 'FLAGGED' THEN r.polling_unit_id END)::int AS flagged_polling_units,
        COUNT(DISTINCT CASE WHEN r.audit_status = 'REJECTED' THEN r.polling_unit_id END)::int AS rejected_polling_units,
        
        -- Approved Totals
        COALESCE(SUM(CASE WHEN r.is_verified = true THEN r.total_valid_votes ELSE 0 END), 0)::int AS approved_valid_votes,
        COALESCE(SUM(CASE WHEN r.is_verified = true THEN r.rejected_votes ELSE 0 END), 0)::int AS approved_rejected_votes,
        COALESCE(SUM(CASE WHEN r.is_verified = true THEN r.total_accredited_voters ELSE 0 END), 0)::int AS approved_accredited_voters,
        COALESCE(SUM(CASE WHEN r.is_verified = true THEN r.total_registered_voters ELSE 0 END), 0)::int AS approved_registered_voters,
        
        -- Submitted Totals (all results)
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
    const submittedPus = row.submitted_polling_units || 0;
    const approvedPus = row.approved_polling_units || 0;
    const submissionPercentage =
      totalPus > 0 ? Number(((submittedPus / totalPus) * 100).toFixed(2)) : 0;
    const approvalPercentage =
      totalPus > 0 ? Number(((approvedPus / totalPus) * 100).toFixed(2)) : 0;

    return {
      officeId,
      totalPollingUnits: totalPus,
      submittedPollingUnits: submittedPus,
      submissionPercentage,
      approvedPollingUnits: approvedPus,
      approvalPercentage,
      pendingPollingUnits: row.pending_polling_units || 0,
      flaggedPollingUnits: row.flagged_polling_units || 0,
      rejectedPollingUnits: row.rejected_polling_units || 0,
      approvedTotals: {
        totalValidVotes: row.approved_valid_votes || 0,
        totalRejectedVotes: row.approved_rejected_votes || 0,
        totalAccreditedVoters: row.approved_accredited_voters || 0,
        totalRegisteredVoters: row.approved_registered_voters || 0,
      },
      submittedTotals: {
        totalValidVotes: row.total_valid_votes || 0,
        totalRejectedVotes: row.total_rejected_votes || 0,
        totalAccreditedVoters: row.total_accredited_voters || 0,
        totalRegisteredVoters: row.total_registered_voters || 0,
      },
    };
  }

  // Paginated EC8A form URLs with PU details
  async getOfficeEc8aForms(
    officeId: number,
    page = 1,
    limit = 20,
  ): Promise<{
    data: Record<string, unknown>[];
    total: number;
    page: number;
    limit: number;
  }> {
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

  async findSubmissionsForActivity(params: {
    electoralOfficeId?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
    page: number;
    limit: number;
  }): Promise<{ data: Result[]; total: number; page: number; limit: number }> {
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

    if (params.electoralOfficeId) {
      qb.andWhere('r.electoral_office_id = :officeId', {
        officeId: params.electoralOfficeId,
      });
    }

    if (params.status) {
      qb.andWhere('r.audit_status = :status', {
        status: params.status.toUpperCase(),
      });
    }

    if (params.startDate) {
      qb.andWhere('r.server_received_at >= :startDate', {
        startDate: new Date(params.startDate),
      });
    }

    if (params.endDate) {
      qb.andWhere('r.server_received_at <= :endDate', {
        endDate: new Date(params.endDate),
      });
    }

    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    qb.orderBy('r.server_received_at', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findMySubmissions(userId: number, filters: any): Promise<Result[]> {
    const qb = this.repository
      .createQueryBuilder('result')
      .leftJoinAndSelect('result.electoralOffice', 'office')
      .leftJoinAndSelect('result.pollingUnit', 'pu')
      .where('result.uploaded_by_user_id = :userId', { userId });
      
    if (filters.electoralOfficeId) qb.andWhere('result.electoral_office_id = :electoralOfficeId', { electoralOfficeId: filters.electoralOfficeId });
    if (filters.status) qb.andWhere('result.audit_status = :status', { status: filters.status });
    if (filters.startDate) qb.andWhere('result.client_submitted_at >= :startDate', { startDate: filters.startDate });
    if (filters.endDate) qb.andWhere('result.client_submitted_at <= :endDate', { endDate: filters.endDate });
    
    return qb.orderBy('result.client_submitted_at', 'DESC').getMany();
  }

  async getSubmissionStatsOverview(): Promise<{
    total: number;
    peakDay: string | null;
    peakCount: number;
    averagePerDay: number;
  }> {
    const rawCounts = await this.repository
      .createQueryBuilder('r')
      .select('COUNT(*)::int', 'total')
      .addSelect(
        'COUNT(DISTINCT DATE(r.server_received_at))::int',
        'active_days',
      )
      .getRawOne<{ total: number; active_days: number }>();

    const peakRaw = await this.repository
      .createQueryBuilder('r')
      .select("TO_CHAR(r.server_received_at, 'YYYY-MM-DD')", 'day')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy("TO_CHAR(r.server_received_at, 'YYYY-MM-DD')")
      .orderBy('count', 'DESC')
      .addOrderBy('day', 'DESC')
      .limit(1)
      .getRawOne<{ day: string; count: number }>();

    const total = Number(rawCounts?.total || 0);
    const activeDays = Number(rawCounts?.active_days || 0);
    const averagePerDay =
      activeDays > 0 ? Number((total / activeDays).toFixed(2)) : 0;

    return {
      total,
      peakDay: peakRaw?.day || null,
      peakCount: Number(peakRaw?.count || 0),
      averagePerDay,
    };
  }
}
