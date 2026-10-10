import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ResultRepository } from './result.repository';
import {
  CreateResultDto,
  ResultFilterDto,
  VerifyResultDto,
} from './result.dto';
import { Result, ResultAuditStatus } from './result.entity';
import { User } from '../user/user.entity';
import { RoleCode } from '../role/role.enum';
import { PollingUnit } from '../polling-unit/polling-unit.entity';
import { ElectoralOfficeService } from '../electoral-office/electoral-office.service';
import { StorageService, FileContext } from '../../shared/storage/storage.service';
import { ResultExportService, ReportExportData } from './result-export.service';
import { ResultAnomalyDetector } from './result-anomaly.detector';

@Injectable()
export class ResultService {
  constructor(
    private readonly resultRepository: ResultRepository,
    @InjectRepository(PollingUnit)
    private readonly puRepository: Repository<PollingUnit>,
    private readonly electoralOfficeService: ElectoralOfficeService,
    private readonly storageService: StorageService,
    private readonly exportService: ResultExportService,
    private readonly anomalyDetector: ResultAnomalyDetector,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async submitResult(
    dto: CreateResultDto,
    user: User,
  ): Promise<Result> {
    const userRoleCode = user.role?.code;
    const permittedUploadRoles = [
      RoleCode.PU_AGENT,
      RoleCode.WARD_COORDINATOR,
      RoleCode.LGA_COORDINATOR,
    ];

    if (!permittedUploadRoles.includes(userRoleCode as any)) {
      throw new ForbiddenException(
        'Only Polling Unit Agents, Ward Coordinators, and LGA Coordinators are permitted to submit election results.',
      );
    }

    // 1. Storage Media Validation (Images <= 10MB, Videos <= 50MB, Magic Bytes check)
    if (dto.ec8aPhotoKey) {
      await this.storageService.validateMediaFile(dto.ec8aPhotoKey, 'image');
    }
    if (dto.videoKey) {
      await this.storageService.validateMediaFile(dto.videoKey, 'video');
    }

    // 2. Statistical & Arithmetic Anomaly Detection
    const anomalyReport = this.anomalyDetector.detect(dto);

    // 3. Hierarchical Boundary Validations
    let puId: number;

    if (userRoleCode === RoleCode.PU_AGENT) {
      if (!user.assignedPu?.id) {
        throw new BadRequestException(
          'Authenticated Polling Unit Agent is not assigned to any Polling Unit.',
        );
      }
      if (dto.pollingUnitId && dto.pollingUnitId !== user.assignedPu.id) {
        throw new ForbiddenException(
          'Polling Unit Agents can only submit results for their assigned Polling Unit.',
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
          'pollingUnitId is required for Ward Coordinator result submissions.',
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
          'pollingUnitId is required for LGA Coordinator result submissions.',
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
      throw new ForbiddenException('Unauthorized to submit results.');
    }

    const aspirantId =
      user.aspirant?.id || user.aspirantAccount?.id || dto.aspirantId;
    const partyId =
      user.aspirant?.politicalParty?.id ||
      user.aspirantAccount?.politicalParty?.id ||
      dto.politicalPartyId;

    // Validate PU against Electoral Office boundary
    const boundaries = await this.electoralOfficeService.getOfficeBoundaries(
      dto.electoralOfficeId,
    );
    if (!boundaries.pollingUnitIds.includes(puId)) {
      throw new BadRequestException(
        `Polling Unit #${puId} does not fall within the boundary of Electoral Office #${dto.electoralOfficeId}.`,
      );
    }

    // 4. Check for Existing Submissions / Handle Re-submission on REJECTED
    const existing = await this.resultRepository.findByPollingUnitOfficeAndParty(
      puId,
      dto.electoralOfficeId,
      partyId,
    );

    if (existing) {
      if (existing.auditStatus !== ResultAuditStatus.REJECTED) {
        throw new ConflictException(
          `A result has already been submitted for Polling Unit #${puId} and Electoral Office #${dto.electoralOfficeId} for Party #${partyId} with status '${existing.auditStatus}'. Duplicate submissions are blocked.`,
        );
      }

      // Re-submission / Correction for previously rejected result
      const updateData: Partial<Result> = {
        totalRegisteredVoters: dto.totalRegisteredVoters ?? null,
        totalAccreditedVoters: dto.totalAccreditedVoters ?? null,
        totalValidVotes: Number(dto.totalValidVotes),
        rejectedVotes: Number(dto.rejectedVotes || 0),
        ec8aPhotoUrl: dto.ec8aPhotoKey || existing.ec8aPhotoUrl,
        videoUrl: dto.videoKey || null,
        materialsArrived: dto.materialsArrived,
        uploadedByUser: user,
        clientSubmittedAt: dto.clientSubmittedAt
          ? new Date(dto.clientSubmittedAt)
          : new Date(),
        hasAnomalies: anomalyReport.hasAnomalies,
        anomalyFlags: anomalyReport.flags,
        auditStatus: anomalyReport.hasAnomalies
          ? ResultAuditStatus.FLAGGED
          : ResultAuditStatus.PENDING,
        isVerified: false,
        rejectionReason: anomalyReport.hasAnomalies
          ? anomalyReport.details.join('; ')
          : null,
      };

      const updatedResult = await this.resultRepository.updateTransactional(
        existing.id,
        updateData,
        dto.partyBreakdown,
      );

      await this.invalidateOfficeCaches(dto.electoralOfficeId);
      return updatedResult;
    }

    const resultData: Partial<Result> = {
      electoralOffice: { id: dto.electoralOfficeId } as any,
      pollingUnit: { id: puId } as any,
      politicalParty: { id: partyId } as any,
      aspirant: aspirantId ? ({ id: aspirantId } as any) : null,
      totalRegisteredVoters: dto.totalRegisteredVoters ?? null,
      totalAccreditedVoters: dto.totalAccreditedVoters ?? null,
      totalValidVotes: Number(dto.totalValidVotes),
      rejectedVotes: Number(dto.rejectedVotes || 0),
      ec8aPhotoUrl: dto.ec8aPhotoKey,
      videoUrl: dto.videoKey || null,
      materialsArrived: dto.materialsArrived,
      uploadedByUser: user,
      clientSubmittedAt: dto.clientSubmittedAt
        ? new Date(dto.clientSubmittedAt)
        : new Date(),
      hasAnomalies: anomalyReport.hasAnomalies,
      anomalyFlags: anomalyReport.flags,
      auditStatus: anomalyReport.hasAnomalies
        ? ResultAuditStatus.FLAGGED
        : ResultAuditStatus.PENDING,
      rejectionReason: anomalyReport.hasAnomalies
        ? anomalyReport.details.join('; ')
        : null,
    };

    const savedResult = await this.resultRepository.createTransactional(
      resultData,
      dto.partyBreakdown,
    );

    // 5. Invalidate Electoral Office Caches
    await this.invalidateOfficeCaches(dto.electoralOfficeId);

    return savedResult;
  }

  async findOne(id: number): Promise<Result> {
    const result = await this.resultRepository.findById(id);
    if (!result) {
      throw new NotFoundException(`Result with ID #${id} not found.`);
    }

    // Generate secure short-lived URLs for media
    const ec8aPhotoUrl = await this.storageService.getPresignedDownloadUrl(
      result.ec8aPhotoUrl,
    );
    const videoUrl = result.videoUrl
      ? await this.storageService.getPresignedDownloadUrl(result.videoUrl)
      : null;

    return {
      ...result,
      ec8aPhotoUrl,
      videoUrl,
    } as Result;
  }

  async findByPollingUnit(pollingUnitId: number): Promise<Result[]> {
    return this.resultRepository.findByPollingUnit(pollingUnitId);
  }

  async findAll(
    filters: ResultFilterDto,
  ): Promise<{ data: Result[]; total: number; page: number; limit: number }> {
    return this.resultRepository.findAll(filters);
  }

  async verifyResult(
    id: number,
    dto: VerifyResultDto,
    verifier: User,
  ): Promise<Result> {
    const existing = await this.resultRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Result with ID #${id} not found.`);
    }

    const verifierAspirantId =
      verifier.aspirantAccount?.id || verifier.aspirant?.id;
    const isPlatformAdmin =
      verifier.role?.code === RoleCode.SUPER_ADMIN ||
      verifier.role?.code === RoleCode.SYSTEM_ADMIN;

    if (!isPlatformAdmin) {
      if (
        !verifierAspirantId ||
        (existing.aspirant?.id && existing.aspirant.id !== verifierAspirantId)
      ) {
        throw new ForbiddenException(
          'You can only verify results belonging to your own campaign.',
        );
      }
    }

    const updated = await this.resultRepository.updateAuditStatus(
      id,
      dto.auditStatus,
      verifier,
      dto.rejectionReason,
    );

    if (existing.electoralOffice?.id) {
      await this.invalidateOfficeCaches(existing.electoralOffice.id);
    }

    return updated!;
  }

  // --- Electoral Office Aggregations & Reports ---

  async getOfficePartySummary(officeId: number, partyId?: number): Promise<any> {
    const cacheKey = `office:summary:${officeId}:party:${partyId || 'all'}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const summary = await this.resultRepository.getOfficePartySummary(officeId, partyId);
    await this.cacheManager.set(cacheKey, summary, 1000 * 30); // 30s TTL
    return summary;
  }

  async getOfficePollingUnitReport(officeId: number, puId: number, partyId?: number): Promise<any> {
    const cacheKey = `office:report:${officeId}:pu:${puId}:party:${partyId || 'all'}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const report = await this.resultRepository.getOfficePollingUnitReport(
      officeId,
      puId,
      partyId
    );
    await this.cacheManager.set(cacheKey, report, 1000 * 30);
    return report;
  }

  async getOfficeWardReport(officeId: number, wardId: number, partyId?: number): Promise<any> {
    const cacheKey = `office:report:${officeId}:ward:${wardId}:party:${partyId || 'all'}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const report = await this.resultRepository.getOfficeWardReport(
      officeId,
      wardId,
      partyId
    );
    await this.cacheManager.set(cacheKey, report, 1000 * 30);
    return report;
  }

  async getOfficeLgaReport(officeId: number, lgaId: number, partyId?: number): Promise<any> {
    const cacheKey = `office:report:${officeId}:lga:${lgaId}:party:${partyId || 'all'}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const report = await this.resultRepository.getOfficeLgaReport(
      officeId,
      lgaId,
      partyId
    );
    await this.cacheManager.set(cacheKey, report, 1000 * 30);
    return report;
  }

  async getOfficeStateReport(officeId: number, stateId: number, partyId?: number): Promise<any> {
    const cacheKey = `office:report:${officeId}:state:${stateId}:party:${partyId || 'all'}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const report = await this.resultRepository.getOfficeStateReport(
      officeId,
      stateId,
      partyId
    );
    await this.cacheManager.set(cacheKey, report, 1000 * 30);
    return report;
  }

  async getOfficeUploadProgress(officeId: number): Promise<any> {
    const cacheKey = `office:progress:${officeId}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const progress =
      await this.resultRepository.getOfficeUploadProgress(officeId);
    await this.cacheManager.set(cacheKey, progress, 1000 * 30);
    return progress;
  }

  async getOfficeEc8aForms(
    officeId: number,
    page = 1,
    limit = 20,
  ): Promise<any> {
    return this.resultRepository.getOfficeEc8aForms(officeId, page, limit);
  }

  private async invalidateOfficeCaches(officeId: number): Promise<void> {
    await this.cacheManager.del(`office:summary:${officeId}`);
    await this.cacheManager.del(`office:progress:${officeId}`);
  }

  async getMediaUploadUrls(
    requestPhoto: boolean,
    requestVideo: boolean,
    photoContentType?: string,
    videoContentType?: string,
  ) {
    const response: any = {};
    
    if (requestPhoto && photoContentType) {
      if (!photoContentType.startsWith('image/')) {
        throw new BadRequestException('EC8A photo must be an image type.');
      }
      response.photo = await this.storageService.getPresignedUploadUrl(
        FileContext.RESULT_DOCUMENT,
        photoContentType,
        10 * 1024 * 1024, // 10MB limit for photos
      );
    }
    
    if (requestVideo && videoContentType) {
      if (!videoContentType.startsWith('video/')) {
        throw new BadRequestException('Video evidence must be a video type.');
      }
      response.video = await this.storageService.getPresignedUploadUrl(
        FileContext.RESULT_DOCUMENT,
        videoContentType,
        50 * 1024 * 1024, // 50MB limit for videos
      );
    }

    if (Object.keys(response).length === 0) {
      throw new BadRequestException(
        'You must request at least one media upload URL (photo or video) with a valid content type.',
      );
    }

    return response;
  }

  // --- Export Methods (PDF & CSV) ---

  async exportOfficePollingUnitReport(
    officeId: number,
    puId: number,
    partyId?: number,
    format: 'pdf' | 'csv' = 'pdf',
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const rawReport = await this.getOfficePollingUnitReport(
      officeId,
      puId,
      partyId,
    );
    const totals = rawReport.totals || {};
    const totalValid = Number(totals.totalValidVotes || 0);
    const rejected = Number(totals.totalRejectedVotes || 0);

    const breakdown = (rawReport.partyBreakdown || []).map((item: any) => {
      const votes = Number(item.totalVotes || 0);
      const percentage =
        totalValid > 0 ? ((votes / totalValid) * 100).toFixed(2) : '0.00';
      return {
        partyCode: item.partyAcronym || 'N/A',
        partyName: item.partyName || 'N/A',
        votes,
        percentage,
      };
    });

    const exportData: ReportExportData = {
      title: `POLLING UNIT RESULT REPORT (#${puId})`,
      scope: 'POLLING_UNIT',
      officeName: `Electoral Office #${officeId}`,
      electoralScope: `Polling Unit ID #${puId}`,
      generatedAt: new Date(),
      summary: {
        totalValidVotes: totalValid,
        rejectedVotes: rejected,
        totalVotesCast: totalValid + rejected,
        totalAccreditedVoters: totals.totalAccreditedVoters,
        totalRegisteredVoters: totals.totalRegisteredVoters,
      },
      breakdown,
    };

    if (format === 'csv') {
      return {
        buffer: this.exportService.generateCsvReport(exportData),
        contentType: 'text/csv',
        filename: `report_pu_${puId}_office_${officeId}.csv`,
      };
    }

    return {
      buffer: await this.exportService.generatePdfReport(exportData),
      contentType: 'application/pdf',
      filename: `report_pu_${puId}_office_${officeId}.pdf`,
    };
  }

  async exportOfficeWardReport(
    officeId: number,
    wardId: number,
    partyId?: number,
    format: 'pdf' | 'csv' = 'pdf',
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const rawReport = await this.getOfficeWardReport(
      officeId,
      wardId,
      partyId,
    );
    const totals = rawReport.totals || {};
    const totalValid = Number(totals.totalValidVotes || 0);
    const rejected = Number(totals.totalRejectedVotes || 0);

    const breakdown = (rawReport.partyBreakdown || []).map((item: any) => {
      const votes = Number(item.totalVotes || 0);
      const percentage =
        totalValid > 0 ? ((votes / totalValid) * 100).toFixed(2) : '0.00';
      return {
        partyCode: item.partyAcronym || 'N/A',
        partyName: item.partyName || 'N/A',
        votes,
        percentage,
      };
    });

    const exportData: ReportExportData = {
      title: `WARD AGGREGATED REPORT (#${wardId})`,
      scope: 'WARD',
      officeName: `Electoral Office #${officeId}`,
      electoralScope: `Ward ID #${wardId}`,
      generatedAt: new Date(),
      summary: {
        totalValidVotes: totalValid,
        rejectedVotes: rejected,
        totalVotesCast: totalValid + rejected,
        totalAccreditedVoters: totals.totalAccreditedVoters,
        totalRegisteredVoters: totals.totalRegisteredVoters,
      },
      breakdown,
    };

    if (format === 'csv') {
      return {
        buffer: this.exportService.generateCsvReport(exportData),
        contentType: 'text/csv',
        filename: `report_ward_${wardId}_office_${officeId}.csv`,
      };
    }

    return {
      buffer: await this.exportService.generatePdfReport(exportData),
      contentType: 'application/pdf',
      filename: `report_ward_${wardId}_office_${officeId}.pdf`,
    };
  }

  async exportOfficeLgaReport(
    officeId: number,
    lgaId: number,
    partyId?: number,
    format: 'pdf' | 'csv' = 'pdf',
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const rawReport = await this.getOfficeLgaReport(officeId, lgaId, partyId);
    const totals = rawReport.totals || {};
    const totalValid = Number(totals.totalValidVotes || 0);
    const rejected = Number(totals.totalRejectedVotes || 0);

    const breakdown = (rawReport.partyBreakdown || []).map((item: any) => {
      const votes = Number(item.totalVotes || 0);
      const percentage =
        totalValid > 0 ? ((votes / totalValid) * 100).toFixed(2) : '0.00';
      return {
        partyCode: item.partyAcronym || 'N/A',
        partyName: item.partyName || 'N/A',
        votes,
        percentage,
      };
    });

    const exportData: ReportExportData = {
      title: `LGA AGGREGATED REPORT (#${lgaId})`,
      scope: 'LGA',
      officeName: `Electoral Office #${officeId}`,
      electoralScope: `Local Government Area #${lgaId}`,
      generatedAt: new Date(),
      summary: {
        totalValidVotes: totalValid,
        rejectedVotes: rejected,
        totalVotesCast: totalValid + rejected,
        totalAccreditedVoters: totals.totalAccreditedVoters,
        totalRegisteredVoters: totals.totalRegisteredVoters,
      },
      breakdown,
    };

    if (format === 'csv') {
      return {
        buffer: this.exportService.generateCsvReport(exportData),
        contentType: 'text/csv',
        filename: `report_lga_${lgaId}_office_${officeId}.csv`,
      };
    }

    return {
      buffer: await this.exportService.generatePdfReport(exportData),
      contentType: 'application/pdf',
      filename: `report_lga_${lgaId}_office_${officeId}.pdf`,
    };
  }

  async exportOfficeStateReport(
    officeId: number,
    stateId: number,
    partyId?: number,
    format: 'pdf' | 'csv' = 'pdf',
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const rawReport = await this.getOfficeStateReport(
      officeId,
      stateId,
      partyId,
    );
    const totals = rawReport.totals || {};
    const totalValid = Number(totals.totalValidVotes || 0);
    const rejected = Number(totals.totalRejectedVotes || 0);

    const breakdown = (rawReport.partyBreakdown || []).map((item: any) => {
      const votes = Number(item.totalVotes || 0);
      const percentage =
        totalValid > 0 ? ((votes / totalValid) * 100).toFixed(2) : '0.00';
      return {
        partyCode: item.partyAcronym || 'N/A',
        partyName: item.partyName || 'N/A',
        votes,
        percentage,
      };
    });

    const exportData: ReportExportData = {
      title: `STATEWIDE AGGREGATED REPORT (#${stateId})`,
      scope: 'STATE',
      officeName: `Electoral Office #${officeId}`,
      electoralScope: `State Jurisdiction #${stateId}`,
      generatedAt: new Date(),
      summary: {
        totalValidVotes: totalValid,
        rejectedVotes: rejected,
        totalVotesCast: totalValid + rejected,
        totalAccreditedVoters: totals.totalAccreditedVoters,
        totalRegisteredVoters: totals.totalRegisteredVoters,
      },
      breakdown,
    };

    if (format === 'csv') {
      return {
        buffer: this.exportService.generateCsvReport(exportData),
        contentType: 'text/csv',
        filename: `report_state_${stateId}_office_${officeId}.csv`,
      };
    }

    return {
      buffer: await this.exportService.generatePdfReport(exportData),
      contentType: 'application/pdf',
      filename: `report_state_${stateId}_office_${officeId}.pdf`,
    };
  }
}
