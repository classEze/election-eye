import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Result, ResultAuditStatus } from './result.entity';
import { ResultDetail } from '../result-detail/result-detail.entity';
import {
  ResultFilterDto,
  SituationRoomFilterDto,
  RecentSubmissionsFilterDto,
} from './result.dto';
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
      .leftJoinAndSelect('breakdown.politicalParty', 'party')
      .leftJoinAndSelect('r.preElectionReport', 'preElectionReport');

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
      .addSelect('party.code', 'partyCode')
      .addSelect('party.code', 'partyAcronym')
      .addSelect('party.party_color_hex', 'partyColorHex')
      .addSelect('party.logo_url', 'logoUrl')
      .addSelect('COALESCE(SUM(rd.votes), 0)::int', 'totalVotes')
      .where('r.electoral_office_id = :officeId', { officeId })
      .andWhere('r.is_verified = true');

    if (partyId) {
      qb.andWhere('r.political_party_id = :partyId', { partyId });
    }

    return qb.groupBy('party.id')
      .addGroupBy('party.name')
      .addGroupBy('party.code')
      .addGroupBy('party.party_color_hex')
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

  // Upload progress stats for an electoral office (Full pipeline: Submissions & Approvals with boundary filters)
  async getOfficeUploadProgress(
    officeId: number,
    filters: SituationRoomFilterDto = {},
  ): Promise<{
    officeId: number;
    totalLgas: number;
    totalWards: number;
    totalPollingUnits: number;
    submittedPollingUnits: number;
    submissionPercentage: number;
    approvedPollingUnits: number;
    approvalPercentage: number;
    pendingPollingUnits: number;
    pendingAuditPollingUnits: number;
    flaggedPollingUnits: number;
    rejectedPollingUnits: number;
    auditBreakdown: {
      verified: number;
      pending: number;
      flagged: number;
      rejected: number;
    };
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
    // 1. Boundary Polling Units & Totals Query
    const puQueryParams: any[] = [officeId];
    let puFilterSql = '';
    if (filters.stateId) {
      puQueryParams.push(filters.stateId);
      puFilterSql += ` AND l.state_id = $${puQueryParams.length}`;
    }
    if (filters.lgaId) {
      puQueryParams.push(filters.lgaId);
      puFilterSql += ` AND l.id = $${puQueryParams.length}`;
    }
    if (filters.wardId) {
      puQueryParams.push(filters.wardId);
      puFilterSql += ` AND w.id = $${puQueryParams.length}`;
    }
    if (filters.pollingUnitId) {
      puQueryParams.push(filters.pollingUnitId);
      puFilterSql += ` AND pu.id = $${puQueryParams.length}`;
    }

    const puTotalsStats = await this.repository.manager.query(
      `
      SELECT 
        COUNT(DISTINCT pu.id)::int AS total_polling_units,
        COUNT(DISTINCT w.id)::int AS total_wards,
        COUNT(DISTINCT l.id)::int AS total_lgas
      FROM polling_units pu
      JOIN wards w ON w.id = pu.ward_id
      JOIN lgas l ON l.id = w.lga_id
      JOIN electoral_offices eo ON eo.id = $1
      LEFT JOIN office_lgas ol ON ol.office_id = eo.id AND ol.lga_id = l.id
      LEFT JOIN office_wards ow ON ow.office_id = eo.id AND ow.ward_id = w.id
      WHERE (
        (eo.category = 'GUBERNATORIAL' AND l.state_id = eo.state_id)
        OR (eo.category = 'PRESIDENTIAL')
        OR (ol.lga_id IS NOT NULL)
        OR (ow.ward_id IS NOT NULL)
      )
      ${puFilterSql}
      `,
      puQueryParams,
    );

    const puRow = puTotalsStats[0] || {};
    const totalPus = Number(puRow.total_polling_units || 0);
    const totalWards = Number(puRow.total_wards || 0);
    const totalLgas = Number(puRow.total_lgas || 0);

    // 2. Results Submission & Verification Stats Query
    const resQueryParams: any[] = [officeId];
    let resFilterSql = '';
    if (filters.stateId) {
      resQueryParams.push(filters.stateId);
      resFilterSql += ` AND l.state_id = $${resQueryParams.length}`;
    }
    if (filters.lgaId) {
      resQueryParams.push(filters.lgaId);
      resFilterSql += ` AND l.id = $${resQueryParams.length}`;
    }
    if (filters.wardId) {
      resQueryParams.push(filters.wardId);
      resFilterSql += ` AND w.id = $${resQueryParams.length}`;
    }
    if (filters.pollingUnitId) {
      resQueryParams.push(filters.pollingUnitId);
      resFilterSql += ` AND pu.id = $${resQueryParams.length}`;
    }

    const resStats = await this.repository.manager.query(
      `
      SELECT 
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
      JOIN polling_units pu ON pu.id = r.polling_unit_id
      JOIN wards w ON w.id = pu.ward_id
      JOIN lgas l ON l.id = w.lga_id
      WHERE r.electoral_office_id = $1
      ${resFilterSql}
      `,
      resQueryParams,
    );

    const row = resStats[0] || {};
    const submittedPus = Number(row.submitted_polling_units || 0);
    const approvedPus = Number(row.approved_polling_units || 0);
    const pendingReviewPus = Number(row.pending_polling_units || 0);
    const flaggedPus = Number(row.flagged_polling_units || 0);
    const rejectedPus = Number(row.rejected_polling_units || 0);
    const unsubmittedPus = Math.max(0, totalPus - submittedPus);

    const submissionPercentage =
      totalPus > 0 ? Number(((submittedPus / totalPus) * 100).toFixed(2)) : 0;
    const approvalPercentage =
      totalPus > 0 ? Number(((approvedPus / totalPus) * 100).toFixed(2)) : 0;

    return {
      officeId,
      totalLgas,
      totalWards,
      totalPollingUnits: totalPus,
      submittedPollingUnits: submittedPus,
      submissionPercentage,
      approvedPollingUnits: approvedPus,
      approvalPercentage,
      pendingPollingUnits: unsubmittedPus, // Awaiting agents to upload
      pendingAuditPollingUnits: pendingReviewPus, // Awaiting admin/aspirant verification
      flaggedPollingUnits: flaggedPus,
      rejectedPollingUnits: rejectedPus,
      auditBreakdown: {
        verified: approvedPus,
        pending: pendingReviewPus,
        flagged: flaggedPus,
        rejected: rejectedPus,
      },
      approvedTotals: {
        totalValidVotes: Number(row.approved_valid_votes || 0),
        totalRejectedVotes: Number(row.approved_rejected_votes || 0),
        totalAccreditedVoters: Number(row.approved_accredited_voters || 0),
        totalRegisteredVoters: Number(row.approved_registered_voters || 0),
      },
      submittedTotals: {
        totalValidVotes: Number(row.total_valid_votes || 0),
        totalRejectedVotes: Number(row.total_rejected_votes || 0),
        totalAccreditedVoters: Number(row.total_accredited_voters || 0),
        totalRegisteredVoters: Number(row.total_registered_voters || 0),
      },
    };
  }

  // Party Standings & Live Results Snapshot Aggregation
  async getSituationRoomStandings(
    officeId: number,
    filters: SituationRoomFilterDto = {},
    partyId?: number,
  ): Promise<{
    totalValidVotes: number;
    leadingParty: {
      partyId: number;
      partyName: string;
      partyCode: string;
      partyAcronym: string;
      partyColorHex: string | null;
      partyColor: string | null;
      logoUrl: string | null;
      totalVotes: number;
      percentage: number;
    } | null;
    standings: Array<{
      rank: number;
      partyId: number;
      partyName: string;
      partyCode: string;
      partyAcronym: string;
      partyColorHex: string | null;
      partyColor: string | null;
      logoUrl: string | null;
      totalVotes: number;
      percentage: number;
    }>;
  }> {
    const qb = this.resultDetailRepository
      .createQueryBuilder('rd')
      .innerJoin('rd.result', 'r')
      .innerJoin('rd.politicalParty', 'party')
      .innerJoin('r.pollingUnit', 'pu')
      .innerJoin('pu.ward', 'ward')
      .innerJoin('ward.lga', 'lga')
      .select('party.id', 'partyId')
      .addSelect('party.name', 'partyName')
      .addSelect('party.code', 'partyCode')
      .addSelect('party.code', 'partyAcronym')
      .addSelect('party.party_color_hex', 'partyColorHex')
      .addSelect('party.logo_url', 'logoUrl')
      .addSelect('COALESCE(SUM(rd.votes), 0)::int', 'totalVotes')
      .where('r.electoral_office_id = :officeId', { officeId });

    const isVerifiedOnly = !(
      filters.includeUnverified || filters.status === 'all'
    );
    if (isVerifiedOnly) {
      qb.andWhere('r.is_verified = true');
    } else {
      qb.andWhere('r.audit_status != :rejectedStatus', {
        rejectedStatus: ResultAuditStatus.REJECTED,
      });
    }

    if (filters.stateId) {
      qb.andWhere('lga.state_id = :stateId', { stateId: filters.stateId });
    }
    if (filters.lgaId) {
      qb.andWhere('ward.lga_id = :lgaId', { lgaId: filters.lgaId });
    }
    if (filters.wardId) {
      qb.andWhere('pu.ward_id = :wardId', { wardId: filters.wardId });
    }
    if (filters.pollingUnitId) {
      qb.andWhere('r.polling_unit_id = :puId', {
        puId: filters.pollingUnitId,
      });
    }
    if (partyId) {
      qb.andWhere('party.id = :partyId', { partyId });
    }

    const rawStandings = await qb
      .groupBy('party.id')
      .addGroupBy('party.name')
      .addGroupBy('party.code')
      .addGroupBy('party.party_color_hex')
      .addGroupBy('party.logo_url')
      .orderBy('SUM(rd.votes)', 'DESC')
      .getRawMany();

    const totalValidVotes = rawStandings.reduce(
      (sum, row) => sum + Number(row.totalVotes || 0),
      0,
    );

    const standings = rawStandings.map((row, index) => {
      const votes = Number(row.totalVotes || 0);
      const percentage =
        totalValidVotes > 0
          ? Number(((votes / totalValidVotes) * 100).toFixed(1))
          : 0;
      return {
        rank: index + 1,
        partyId: Number(row.partyId),
        partyName: row.partyName,
        partyCode: row.partyCode || row.partyAcronym,
        partyAcronym: row.partyCode || row.partyAcronym,
        partyColorHex: row.partyColorHex || null,
        partyColor: row.partyColorHex || null,
        logoUrl: row.logoUrl,
        totalVotes: votes,
        percentage,
      };
    });

    const leadingParty = standings.length > 0 ? standings[0] : null;

    return {
      totalValidVotes,
      leadingParty,
      standings,
    };
  }

  // Recent Submissions Feed (Live stream)
  async getRecentSubmissions(
    officeId: number,
    filters: RecentSubmissionsFilterDto = {},
  ): Promise<
    Array<{
      resultId: number;
      pollingUnit: { id: number; name: string; puCode: string };
      ward: { id: number; name: string };
      lga: { id: number; name: string };
      submittedBy: { id: number; fullName: string; email: string };
      politicalParty: {
        id: number;
        name: string;
        code: string;
        partyColorHex: string | null;
        partyColor: string | null;
        logoUrl: string | null;
      } | null;
      auditStatus: ResultAuditStatus;
      isVerified: boolean;
      clientSubmittedAt: Date;
      serverReceivedAt: Date;
      timeAgo: string;
    }>
  > {
    const limit = filters.limit || 10;
    const qb = this.repository
      .createQueryBuilder('r')
      .innerJoin('r.pollingUnit', 'pu')
      .innerJoin('pu.ward', 'ward')
      .innerJoin('ward.lga', 'lga')
      .innerJoin('r.uploadedByUser', 'uploader')
      .leftJoin('r.politicalParty', 'party')
      .select('r.id', 'resultId')
      .addSelect('r.audit_status', 'auditStatus')
      .addSelect('r.is_verified', 'isVerified')
      .addSelect('r.client_submitted_at', 'clientSubmittedAt')
      .addSelect('r.server_received_at', 'serverReceivedAt')
      .addSelect('pu.id', 'pollingUnitId')
      .addSelect('pu.name', 'pollingUnitName')
      .addSelect('pu.pu_code', 'puCode')
      .addSelect('ward.id', 'wardId')
      .addSelect('ward.name', 'wardName')
      .addSelect('lga.id', 'lgaId')
      .addSelect('lga.name', 'lgaName')
      .addSelect('uploader.id', 'uploaderId')
      .addSelect('uploader.full_name', 'uploaderFullName')
      .addSelect('uploader.email', 'uploaderEmail')
      .addSelect('party.id', 'partyId')
      .addSelect('party.name', 'partyName')
      .addSelect('party.code', 'partyCode')
      .addSelect('party.party_color_hex', 'partyColorHex')
      .addSelect('party.logo_url', 'partyLogoUrl')
      .where('r.electoral_office_id = :officeId', { officeId });

    if (filters.stateId) {
      qb.andWhere('lga.state_id = :stateId', { stateId: filters.stateId });
    }
    if (filters.lgaId) {
      qb.andWhere('ward.lga_id = :lgaId', { lgaId: filters.lgaId });
    }
    if (filters.wardId) {
      qb.andWhere('pu.ward_id = :wardId', { wardId: filters.wardId });
    }
    if (filters.pollingUnitId) {
      qb.andWhere('r.polling_unit_id = :puId', {
        puId: filters.pollingUnitId,
      });
    }

    const auditStatusFilter = filters.auditStatus || filters.status;
    if (auditStatusFilter) {
      qb.andWhere('r.audit_status = :auditStatus', {
        auditStatus: auditStatusFilter,
      });
    }

    const rawList = await qb
      .orderBy('r.server_received_at', 'DESC')
      .limit(limit)
      .getRawMany();

    return rawList.map((row) => {
      const serverReceivedAt = new Date(row.serverReceivedAt);
      const timeAgoMinutes = Math.max(
        0,
        Math.floor((Date.now() - serverReceivedAt.getTime()) / 60000),
      );
      const timeAgo =
        timeAgoMinutes < 1
          ? 'Just now'
          : timeAgoMinutes < 60
          ? `${timeAgoMinutes} min ago`
          : `${Math.floor(timeAgoMinutes / 60)} hr ago`;

      return {
        resultId: Number(row.resultId),
        pollingUnit: {
          id: Number(row.pollingUnitId),
          name: row.pollingUnitName,
          puCode: row.puCode,
        },
        ward: {
          id: Number(row.wardId),
          name: row.wardName,
        },
        lga: {
          id: Number(row.lgaId),
          name: row.lgaName,
        },
        submittedBy: {
          id: Number(row.uploaderId),
          fullName: row.uploaderFullName,
          email: row.uploaderEmail,
        },
        politicalParty: row.partyId
          ? {
              id: Number(row.partyId),
              name: row.partyName,
              code: row.partyCode,
              partyColorHex: row.partyColorHex || null,
              partyColor: row.partyColorHex || null,
              logoUrl: row.partyLogoUrl,
            }
          : null,
        auditStatus: row.auditStatus as ResultAuditStatus,
        isVerified: Boolean(row.isVerified),
        clientSubmittedAt: row.clientSubmittedAt,
        serverReceivedAt: row.serverReceivedAt,
        timeAgo,
      };
    });
  }

  // Count incidents within the electoral office boundary
  async countIncidentsForOffice(
    officeId: number,
    filters: SituationRoomFilterDto = {},
  ): Promise<number> {
    const queryParams: any[] = [officeId];
    let filterSql = '';
    if (filters.stateId) {
      queryParams.push(filters.stateId);
      filterSql += ` AND l.state_id = $${queryParams.length}`;
    }
    if (filters.lgaId) {
      queryParams.push(filters.lgaId);
      filterSql += ` AND l.id = $${queryParams.length}`;
    }
    if (filters.wardId) {
      queryParams.push(filters.wardId);
      filterSql += ` AND w.id = $${queryParams.length}`;
    }
    if (filters.pollingUnitId) {
      queryParams.push(filters.pollingUnitId);
      filterSql += ` AND pu.id = $${queryParams.length}`;
    }

    const result = await this.repository.manager.query(
      `
      SELECT COUNT(DISTINCT i.id)::int AS total_incidents
      FROM incidents i
      LEFT JOIN polling_units pu ON pu.id = i.polling_unit_id
      LEFT JOIN wards w ON w.id = COALESCE(i.ward_id, pu.ward_id)
      LEFT JOIN lgas l ON l.id = COALESCE(i.lga_id, w.lga_id)
      JOIN electoral_offices eo ON eo.id = $1
      LEFT JOIN office_lgas ol ON ol.office_id = eo.id AND ol.lga_id = l.id
      LEFT JOIN office_wards ow ON ow.office_id = eo.id AND ow.ward_id = w.id
      WHERE (
        (eo.category = 'GUBERNATORIAL' AND l.state_id = eo.state_id)
        OR (eo.category = 'PRESIDENTIAL')
        OR (ol.lga_id IS NOT NULL)
        OR (ow.ward_id IS NOT NULL)
      )
      ${filterSql}
      `,
      queryParams,
    );

    return Number(result[0]?.total_incidents || 0);
  }

  // Last submission details for an electoral office
  async getLastSubmission(
    officeId: number,
    filters: SituationRoomFilterDto = {},
  ): Promise<{
    pollingUnitId: number;
    pollingUnitName: string;
    puCode: string;
    wardName: string;
    lgaName: string;
    uploaderName: string;
    submittedAt: Date;
    timeAgoMinutes: number;
    timeAgo: string;
  } | null> {
    const qb = this.repository
      .createQueryBuilder('r')
      .innerJoin('r.pollingUnit', 'pu')
      .innerJoin('pu.ward', 'ward')
      .innerJoin('ward.lga', 'lga')
      .innerJoin('r.uploadedByUser', 'uploader')
      .select('pu.id', 'pollingUnitId')
      .addSelect('pu.name', 'pollingUnitName')
      .addSelect('pu.pu_code', 'puCode')
      .addSelect('ward.name', 'wardName')
      .addSelect('lga.name', 'lgaName')
      .addSelect('uploader.full_name', 'uploaderName')
      .addSelect('r.server_received_at', 'submittedAt')
      .where('r.electoral_office_id = :officeId', { officeId });

    if (filters.stateId) {
      qb.andWhere('lga.state_id = :stateId', { stateId: filters.stateId });
    }
    if (filters.lgaId) {
      qb.andWhere('ward.lga_id = :lgaId', { lgaId: filters.lgaId });
    }
    if (filters.wardId) {
      qb.andWhere('pu.ward_id = :wardId', { wardId: filters.wardId });
    }
    if (filters.pollingUnitId) {
      qb.andWhere('r.polling_unit_id = :puId', {
        puId: filters.pollingUnitId,
      });
    }

    const raw = await qb
      .orderBy('r.server_received_at', 'DESC')
      .limit(1)
      .getRawOne();

    if (!raw) return null;

    const submittedAt = new Date(raw.submittedAt);
    const timeAgoMinutes = Math.max(
      0,
      Math.floor((Date.now() - submittedAt.getTime()) / 60000),
    );
    const timeAgo =
      timeAgoMinutes < 1
        ? 'Just now'
        : timeAgoMinutes < 60
        ? `${timeAgoMinutes} mins ago`
        : `${Math.floor(timeAgoMinutes / 60)} hrs ago`;

    return {
      pollingUnitId: Number(raw.pollingUnitId),
      pollingUnitName: raw.pollingUnitName,
      puCode: raw.puCode,
      wardName: raw.wardName,
      lgaName: raw.lgaName,
      uploaderName: raw.uploaderName,
      submittedAt,
      timeAgoMinutes,
      timeAgo,
    };
  }

  // Unified Situation Room Dashboard Data
  async getSituationRoomData(
    officeId: number,
    filters: SituationRoomFilterDto = {},
    partyId?: number,
  ) {
    const [
      progress,
      standingsData,
      recentSubmissions,
      incidentsReported,
      lastSubmission,
    ] = await Promise.all([
      this.getOfficeUploadProgress(officeId, filters),
      this.getSituationRoomStandings(officeId, filters, partyId),
      this.getRecentSubmissions(officeId, {
        stateId: filters.stateId,
        lgaId: filters.lgaId,
        wardId: filters.wardId,
        pollingUnitId: filters.pollingUnitId,
        auditStatus: filters.auditStatus,
        limit: 10,
      }),
      this.countIncidentsForOffice(officeId, filters),
      this.getLastSubmission(officeId, filters),
    ]);

    const cards = {
      wardsAssigned: progress.totalWards,
      puAssigned: progress.totalPollingUnits,
      totalSubmissions: progress.submittedPollingUnits,
      submissionPercentage: progress.submissionPercentage,
      pendingSubmissions: progress.pendingPollingUnits, // Awaiting agent upload
      pendingReviewSubmissions: progress.pendingAuditPollingUnits, // Awaiting verification
      totalVotesCounted: progress.submittedTotals.totalValidVotes,
      leadingParty: standingsData.leadingParty,
      incidentsReported,
      lastSubmission,
    };

    const liveResultsSnapshot = {
      totalValidVotes: standingsData.totalValidVotes,
      leadingParty: standingsData.leadingParty,
      parties: standingsData.standings.map((s) => ({
        partyId: s.partyId,
        partyName: s.partyName,
        partyCode: s.partyCode,
        partyAcronym: s.partyAcronym,
        partyColorHex: s.partyColorHex,
        partyColor: s.partyColor,
        logoUrl: s.logoUrl,
        totalVotes: s.totalVotes,
        percentage: s.percentage,
      })),
    };

    return {
      officeId,
      cards,
      liveResultsSnapshot,
      partyStandings: standingsData.standings,
      submissionProgress: {
        totalPollingUnits: progress.totalPollingUnits,
        submittedPollingUnits: progress.submittedPollingUnits,
        pendingPollingUnits: progress.pendingPollingUnits,
        submissionPercentage: progress.submissionPercentage,
        approvedPollingUnits: progress.approvedPollingUnits,
        approvalPercentage: progress.approvalPercentage,
        auditStatusBreakdown: progress.auditBreakdown,
      },
      recentSubmissions,
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
      .leftJoinAndSelect('breakdown.politicalParty', 'party')
      .leftJoinAndSelect('r.preElectionReport', 'preElectionReport');

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
