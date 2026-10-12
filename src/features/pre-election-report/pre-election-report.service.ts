import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PreElectionReportRepository } from './pre-election-report.repository';
import {
  CreatePreElectionReportDto,
  PreElectionReportFilterDto,
} from './pre-election-report.dto';
import { PreElectionReport } from './pre-election-report.entity';
import { User } from '../user/user.entity';
import { RoleCode } from '../role/role.enum';
import { PollingUnit } from '../polling-unit/polling-unit.entity';
import { ElectoralOfficeService } from '../electoral-office/electoral-office.service';
import { Result } from '../result/result.entity';

@Injectable()
export class PreElectionReportService {
  constructor(
    private readonly preElectionReportRepository: PreElectionReportRepository,
    @InjectRepository(PollingUnit)
    private readonly puRepository: Repository<PollingUnit>,
    @InjectRepository(Result)
    private readonly resultRepository: Repository<Result>,
    private readonly electoralOfficeService: ElectoralOfficeService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async submitPreElectionReport(
    dto: CreatePreElectionReportDto,
    user: User,
  ): Promise<PreElectionReport> {
    const userRoleCode = user.role?.code;
    const permittedUploadRoles = [
      RoleCode.PU_AGENT,
      RoleCode.WARD_COORDINATOR,
      RoleCode.LGA_COORDINATOR,
    ];

    if (!permittedUploadRoles.includes(userRoleCode as any)) {
      throw new ForbiddenException(
        'Only Polling Unit Agents, Ward Coordinators, and LGA Coordinators are permitted to submit pre-election reports.',
      );
    }

    let puId: number;

    if (userRoleCode === RoleCode.PU_AGENT) {
      if (!user.assignedPu?.id) {
        throw new BadRequestException(
          'Authenticated Polling Unit Agent is not assigned to any Polling Unit.',
        );
      }
      if (dto.pollingUnitId && dto.pollingUnitId !== user.assignedPu.id) {
        throw new ForbiddenException(
          'Polling Unit Agents can only submit pre-election reports for their assigned Polling Unit.',
        );
      }
      puId = user.assignedPu.id;
    } else if (userRoleCode === RoleCode.WARD_COORDINATOR) {
      if (!user.assignedWard?.id) {
        throw new BadRequestException(
          'Authenticated Ward Coordinator is not assigned to any Ward.',
        );
      }
      if (!dto.pollingUnitId) {
        throw new BadRequestException(
          'pollingUnitId is required for Ward Coordinator submissions.',
        );
      }
      const pu = await this.puRepository.findOne({
        where: { id: dto.pollingUnitId },
        relations: { ward: true },
      });
      if (!pu) {
        throw new NotFoundException(
          `Polling Unit with ID #${dto.pollingUnitId} not found.`,
        );
      }
      if (pu.ward?.id !== user.assignedWard.id) {
        throw new ForbiddenException(
          'The selected Polling Unit does not fall within your assigned Ward.',
        );
      }
      puId = dto.pollingUnitId;
    } else if (userRoleCode === RoleCode.LGA_COORDINATOR) {
      if (!user.assignedLga?.id) {
        throw new BadRequestException(
          'Authenticated LGA Coordinator is not assigned to any LGA.',
        );
      }
      if (!dto.pollingUnitId) {
        throw new BadRequestException(
          'pollingUnitId is required for LGA Coordinator submissions.',
        );
      }
      const pu = await this.puRepository.findOne({
        where: { id: dto.pollingUnitId },
        relations: { ward: { lga: true } },
      });
      if (!pu) {
        throw new NotFoundException(
          `Polling Unit with ID #${dto.pollingUnitId} not found.`,
        );
      }
      if (pu.ward?.lga?.id !== user.assignedLga.id) {
        throw new ForbiddenException(
          'The selected Polling Unit does not fall within your assigned LGA.',
        );
      }
      puId = dto.pollingUnitId;
    } else {
      throw new ForbiddenException('Unauthorized to submit pre-election report.');
    }

    // Validate PU against Electoral Office boundary
    const boundaries = await this.electoralOfficeService.getOfficeBoundaries(
      dto.electoralOfficeId,
    );
    if (!boundaries.pollingUnitIds.includes(puId)) {
      throw new BadRequestException(
        `Polling Unit #${puId} does not fall within the boundary of Electoral Office #${dto.electoralOfficeId}.`,
      );
    }

    const aspirantId =
      user.aspirant?.id || user.aspirantAccount?.id || dto.aspirantId;
    const partyId =
      user.aspirant?.politicalParty?.id ||
      user.aspirantAccount?.politicalParty?.id ||
      dto.politicalPartyId;

    const reportData: Partial<PreElectionReport> = {
      electoralOffice: { id: dto.electoralOfficeId } as any,
      pollingUnit: { id: puId } as any,
      uploadedByUser: user,
      politicalParty: partyId ? ({ id: partyId } as any) : null,
      aspirant: aspirantId ? ({ id: aspirantId } as any) : null,
      materialsArrived: dto.materialsArrived,
      materialArrivalTime: dto.materialArrivalTime
        ? new Date(dto.materialArrivalTime)
        : null,
      totalAccreditedVoters: dto.totalAccreditedVoters ?? null,
      comments: dto.comments ?? null,
      clientSubmittedAt: dto.clientSubmittedAt
        ? new Date(dto.clientSubmittedAt)
        : new Date(),
    };

    const saved = await this.preElectionReportRepository.createOrUpdate(reportData);

    // Link this PreElectionReport to any existing Result records for this PU & Electoral Office
    await this.resultRepository.update(
      {
        pollingUnit: { id: puId },
        electoralOffice: { id: dto.electoralOfficeId },
      },
      {
        preElectionReport: saved,
      },
    );

    // Invalidate caches
    await this.cacheManager.del(`office:summary:${dto.electoralOfficeId}`);
    await this.cacheManager.del(`office:progress:${dto.electoralOfficeId}`);

    return saved;
  }

  async findByPollingUnitAndOffice(
    puId: number,
    officeId: number,
  ): Promise<PreElectionReport | null> {
    return this.preElectionReportRepository.findByPollingUnitAndOffice(
      puId,
      officeId,
    );
  }

  async findOne(id: number): Promise<PreElectionReport> {
    const report = await this.preElectionReportRepository.findById(id);
    if (!report) {
      throw new NotFoundException(`Pre-election report with ID #${id} not found.`);
    }
    return report;
  }

  async findAll(
    filters: PreElectionReportFilterDto,
  ): Promise<{ data: PreElectionReport[]; total: number; page: number; limit: number }> {
    return this.preElectionReportRepository.findAll(filters);
  }
}
