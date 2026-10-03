import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { StateRepository } from '../state/state.repository';
import { LgaRepository } from '../lga/lga.repository';
import { WardRepository } from '../ward/ward.repository';
import { PollingUnitRepository } from '../polling-unit/polling-unit.repository';
import { AspirantRepository } from '../aspirant/aspirant.repository';
import { UserRepository } from '../user/user.repository';
import { PoliticalPartyRepository } from '../political-party/political-party.repository';
import { ElectoralOfficeRepository } from '../electoral-office/electoral-office.repository';
import { AdminRepository } from '../admin/admin.repository';
import { ResultRepository } from '../result/result.repository';
import { IncidentRepository } from '../incident/incident.repository';
import {
  AllTimeIncidentSubmissionStatsDto,
  SubmissionsAndIncidentsFilterDto,
  SubmissionsAndIncidentsResponseDto,
  SystemActorsSummaryDto,
  ActivityType,
  MySubmissionsFilterDto,
} from './report.dto';
import * as Papa from 'papaparse';

const REPORT_CACHE_KEY = 'report:system:actors_summary';
const REPORT_STATS_CACHE_KEY = 'report:system:incident_submission_stats';
const REPORT_CACHE_TTL = 60 * 1000; // 60 seconds

@Injectable()
export class ReportService {
  constructor(
    private readonly stateRepository: StateRepository,
    private readonly lgaRepository: LgaRepository,
    private readonly wardRepository: WardRepository,
    private readonly pollingUnitRepository: PollingUnitRepository,
    private readonly aspirantRepository: AspirantRepository,
    private readonly userRepository: UserRepository,
    private readonly politicalPartyRepository: PoliticalPartyRepository,
    private readonly electoralOfficeRepository: ElectoralOfficeRepository,
    private readonly adminRepository: AdminRepository,
    private readonly resultRepository: ResultRepository,
    private readonly incidentRepository: IncidentRepository,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Fetches a high-performance aggregated count of all major actors and administrative boundaries.
   * Leverages Redis caching with a 60-second TTL and executes parallel DB aggregate counts on cache miss.
   */
  async getSystemActorsSummary(): Promise<SystemActorsSummaryDto> {
    const cached =
      await this.cacheManager.get<SystemActorsSummaryDto>(REPORT_CACHE_KEY);
    if (cached) {
      return cached;
    }

    // Execute all count queries in parallel for optimal database response time
    const [
      totalStates,
      totalLgas,
      totalWards,
      totalPollingUnits,
      aspirants,
      coordinatorsAndAgents,
      totalPoliticalParties,
      totalElectoralOffices,
      admins,
    ] = await Promise.all([
      this.stateRepository.count(),
      this.lgaRepository.count(),
      this.wardRepository.count(),
      this.pollingUnitRepository.count(),
      this.aspirantRepository.countAspirants(),
      this.userRepository.countCoordinatorsAndAgents(),
      this.politicalPartyRepository.count(),
      this.electoralOfficeRepository.count(),
      this.adminRepository.countAdminSummary(),
    ]);

    const summary: SystemActorsSummaryDto = {
      totalStates,
      totalLgas,
      totalWards,
      totalPollingUnits,
      aspirants,
      totalLgaCoordinators: coordinatorsAndAgents.lgaCoordinators,
      totalWardCoordinators: coordinatorsAndAgents.wardCoordinators,
      totalPollingUnitAgents: coordinatorsAndAgents.puAgents,
      totalPoliticalParties,
      totalElectoralOffices,
      admins,
    };

    await this.cacheManager.set(REPORT_CACHE_KEY, summary, REPORT_CACHE_TTL);

    return summary;
  }

  /**
   * Fetches submissions (results) and incident activity data.
   * Filterable by electoral office, status, and date range with pagination.
   */
  async getSubmissionsAndIncidents(
    filterDto: SubmissionsAndIncidentsFilterDto,
  ): Promise<SubmissionsAndIncidentsResponseDto> {
    const page = filterDto.page || 1;
    const limit = filterDto.limit || 20;

    const [submissions, incidents] = await Promise.all([
      this.resultRepository.findSubmissionsForActivity({
        electoralOfficeId: filterDto.electoralOfficeId,
        status: filterDto.status,
        startDate: filterDto.startDate,
        endDate: filterDto.endDate,
        page,
        limit,
      }),
      this.incidentRepository.findIncidentsForActivity({
        electoralOfficeId: filterDto.electoralOfficeId,
        status: filterDto.status,
        startDate: filterDto.startDate,
        endDate: filterDto.endDate,
        page,
        limit,
      }),
    ]);

    return {
      submissions,
      incidents,
    };
  }

  /**
   * Fetches all-time aggregated metrics for submissions and incidents:
   * Total counts, peak activity dates and counts, and daily averages.
   */
  async getAllTimeIncidentSubmissionStats(): Promise<AllTimeIncidentSubmissionStatsDto> {
    const cached =
      await this.cacheManager.get<AllTimeIncidentSubmissionStatsDto>(
        REPORT_STATS_CACHE_KEY,
      );
    if (cached) {
      return cached;
    }

    const [submissions, incidents] = await Promise.all([
      this.resultRepository.getSubmissionStatsOverview(),
      this.incidentRepository.getIncidentStatsOverview(),
    ]);

    const stats: AllTimeIncidentSubmissionStatsDto = {
      submissions,
      incidents,
    };

    await this.cacheManager.set(
      REPORT_STATS_CACHE_KEY,
      stats,
      REPORT_CACHE_TTL,
    );

    return stats;
  }

  /**
   * Fetches the unified submission history for a specific user (e.g. PU Agent).
   */
  async getMySubmissions(userId: number, filterDto: MySubmissionsFilterDto) {
    const { activityType, electoralOfficeId, status, startDate, endDate, page, limit } = filterDto;
    
    let results: any[] = [];
    let incidents: any[] = [];
    
    if (activityType === ActivityType.ALL || activityType === ActivityType.RESULT) {
      const rawResults = await this.resultRepository.findMySubmissions(userId, filterDto);
      results = rawResults.map((r: any) => ({ ...r, activityType: 'RESULT', date: r.clientSubmittedAt }));
    }
    
    if (activityType === ActivityType.ALL || activityType === ActivityType.INCIDENT) {
      const rawIncidents = await this.incidentRepository.findMyIncidents(userId, filterDto);
      incidents = rawIncidents.map((i: any) => ({ ...i, activityType: 'INCIDENT', date: i.createdAt || i.reportedAt }));
    }
    
    // Combine and sort
    const combined = [...results, ...incidents].sort((a, b) => b.date.getTime() - a.date.getTime());
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const paginatedData = combined.slice(startIndex, startIndex + limit);
    
    return {
      data: paginatedData,
      total: combined.length,
      page,
      limit
    };
  }

  /**
   * Generates a CSV export of the unified submission history for a specific user.
   */
  async exportMySubmissions(userId: number, filterDto: MySubmissionsFilterDto): Promise<string> {
    // Fetch all records without pagination limits
    const fetchDto = { ...filterDto, page: 1, limit: 1000000 };
    const { data } = await this.getMySubmissions(userId, fetchDto);

    const flattened = data.map((item: any) => {
      const isResult = item.activityType === 'RESULT';
      return {
        ActivityType: item.activityType,
        Date: (isResult ? item.clientSubmittedAt : item.reportedAt)?.toISOString(),
        Status: isResult ? item.auditStatus : item.resolutionStatus,
        PollingUnit: item.pollingUnit?.name || 'N/A',
        ElectoralOffice: item.electoralOffice?.name || 'N/A',
        // Result specific
        TotalValidVotes: isResult ? item.totalValidVotes : 'N/A',
        RejectedVotes: isResult ? item.rejectedVotes : 'N/A',
        MaterialsArrived: isResult ? item.materialsArrived : 'N/A',
        // Incident specific
        IncidentCategory: !isResult ? item.incidentCategory : 'N/A',
        UrgencyLevel: !isResult ? item.urgencyLevel : 'N/A',
        Description: !isResult ? item.description : 'N/A',
      };
    });

    return Papa.unparse(flattened);
  }
}
