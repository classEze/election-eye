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
  PaginatedPreElectionReportsResponse,
  PreElectionReportMediaUploadUrlsDto,
} from './pre-election-report.dto';
import { PreElectionReport } from './pre-election-report.entity';
import { User } from '../user/user.entity';
import { RoleCode } from '../role/role.enum';
import { PollingUnit } from '../polling-unit/polling-unit.entity';
import { ElectoralOfficeService } from '../electoral-office/electoral-office.service';
import { Result } from '../result/result.entity';
import { StorageService, FileContext } from 'src/shared/storage/storage.service';
import {
  isPlatformAdmin,
  getEffectiveAspirantId,
} from 'src/shared/utils/tenant-context.util';

const MAX_PRE_ELECTION_PICTURE_COUNT = 5;
const MAX_PRE_ELECTION_VIDEO_COUNT = 2;

@Injectable()
export class PreElectionReportService {
  constructor(
    private readonly preElectionReportRepository: PreElectionReportRepository,
    @InjectRepository(PollingUnit)
    private readonly puRepository: Repository<PollingUnit>,
    @InjectRepository(Result)
    private readonly resultRepository: Repository<Result>,
    private readonly electoralOfficeService: ElectoralOfficeService,
    private readonly storageService: StorageService,
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
      user.aspirant?.id || user.aspirantAccount?.id;
    if (!aspirantId) {
      throw new BadRequestException(
        'Authenticated user is not affiliated with any aspirant campaign team.',
      );
    }
    const partyId =
      user.aspirant?.politicalParty?.id ||
      user.aspirantAccount?.politicalParty?.id ||
      dto.politicalPartyId;

    // Validate media counts & verify uploads
    const uploadedPictureKeys = dto.mediaPictureKeys || [];
    if (uploadedPictureKeys.length > MAX_PRE_ELECTION_PICTURE_COUNT) {
      throw new BadRequestException(
        `Exceeded picture limit: Maximum allowed is ${MAX_PRE_ELECTION_PICTURE_COUNT} pictures.`,
      );
    }
    for (const key of uploadedPictureKeys) {
      await this.storageService.validateMediaFile(key, 'image');
    }

    const uploadedVideoKeys = dto.mediaVideoKeys || [];
    if (uploadedVideoKeys.length > MAX_PRE_ELECTION_VIDEO_COUNT) {
      throw new BadRequestException(
        `Exceeded video limit: Maximum allowed is ${MAX_PRE_ELECTION_VIDEO_COUNT} videos.`,
      );
    }
    for (const key of uploadedVideoKeys) {
      await this.storageService.validateMediaFile(key, 'video');
    }

    const reportData: Partial<PreElectionReport> = {
      electoralOffice: { id: dto.electoralOfficeId } as any,
      pollingUnit: { id: puId } as any,
      uploadedByUser: user,
      politicalParty: partyId ? ({ id: partyId } as any) : null,
      aspirant: { id: aspirantId } as any,
      materialsArrived: dto.materialsArrived,
      materialArrivalTime: dto.materialArrivalTime
        ? new Date(dto.materialArrivalTime)
        : null,
      totalRegisteredVoters: dto.totalRegisteredVoters ?? null,
      totalAccreditedVoters: dto.totalAccreditedVoters ?? null,
      mediaPictureUrls: uploadedPictureKeys,
      mediaVideoUrls: uploadedVideoKeys,
      comments: dto.comments ?? null,
      clientSubmittedAt: dto.clientSubmittedAt
        ? new Date(dto.clientSubmittedAt)
        : new Date(),
    };

    const saved = await this.preElectionReportRepository.createOrUpdate(reportData);

    // Link this PreElectionReport to any existing Result records for this PU, Electoral Office, and Aspirant
    const resultUpdateWhere: any = {
      pollingUnit: { id: puId },
      electoralOffice: { id: dto.electoralOfficeId },
      aspirant: { id: aspirantId },
    };

    await this.resultRepository.update(
      resultUpdateWhere,
      {
        preElectionReport: saved,
        ...(saved.totalRegisteredVoters != null
          ? { totalRegisteredVoters: saved.totalRegisteredVoters }
          : {}),
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
    aspirantId?: number,
  ): Promise<PreElectionReport | null> {
    const report = await this.preElectionReportRepository.findByPollingUnitAndOffice(
      puId,
      officeId,
      aspirantId,
    );
    if (!report) return null;
    return this.resolveMediaUrls(report);
  }

  async findOne(id: number, user?: User): Promise<PreElectionReport> {
    const report = await this.preElectionReportRepository.findById(id);
    if (!report) {
      throw new NotFoundException(`Pre-election report with ID #${id} not found.`);
    }

    if (user && !isPlatformAdmin(user)) {
      const userAspirantId = getEffectiveAspirantId(user);
      if (report.aspirant?.id && report.aspirant.id !== userAspirantId) {
        throw new ForbiddenException(
          'Access denied to this pre-election report.',
        );
      }
    }

    return this.resolveMediaUrls(report);
  }

  async getMediaUploadUrls(
    dto: PreElectionReportMediaUploadUrlsDto,
  ): Promise<{
    photos: Array<{
      uploadUrl: string;
      method: 'PUT';
      fileKey: string;
      key: string;
      publicUrl: string | null;
      expiresIn: number;
    }>;
    videos: Array<{
      uploadUrl: string;
      method: 'PUT';
      fileKey: string;
      key: string;
      publicUrl: string | null;
      expiresIn: number;
    }>;
  }> {
    const photoCount = dto.requestPhotoCount ?? 0;
    const videoCount = dto.requestVideoCount ?? 0;
    const photoType = dto.photoContentType;
    const videoType = dto.videoContentType;

    const response: {
      photos: Array<{
        uploadUrl: string;
        method: 'PUT';
        fileKey: string;
        key: string;
        publicUrl: string | null;
        expiresIn: number;
      }>;
      videos: Array<{
        uploadUrl: string;
        method: 'PUT';
        fileKey: string;
        key: string;
        publicUrl: string | null;
        expiresIn: number;
      }>;
    } = { photos: [], videos: [] };

    if (photoCount > 0) {
      if (!photoType) {
        throw new BadRequestException(
          'photoContentType is required when requestPhotoCount > 0.',
        );
      }
      if (!photoType.startsWith('image/')) {
        throw new BadRequestException(
          'Pre-election report photos must be an image MIME type (e.g. image/jpeg, image/png).',
        );
      }
      if (photoCount > MAX_PRE_ELECTION_PICTURE_COUNT) {
        throw new BadRequestException(
          `Maximum allowed is ${MAX_PRE_ELECTION_PICTURE_COUNT} photos.`,
        );
      }
      for (let i = 0; i < photoCount; i++) {
        const urlObj = await this.storageService.getPresignedUploadUrl(
          FileContext.PRE_ELECTION_PICTURE,
          photoType,
          10 * 1024 * 1024,
        );
        response.photos.push(urlObj);
      }
    }

    if (videoCount > 0) {
      if (!videoType) {
        throw new BadRequestException(
          'videoContentType is required when requestVideoCount > 0.',
        );
      }
      if (!videoType.startsWith('video/')) {
        throw new BadRequestException(
          'Pre-election report videos must be a video MIME type (e.g. video/mp4).',
        );
      }
      if (videoCount > MAX_PRE_ELECTION_VIDEO_COUNT) {
        throw new BadRequestException(
          `Maximum allowed is ${MAX_PRE_ELECTION_VIDEO_COUNT} videos.`,
        );
      }
      for (let i = 0; i < videoCount; i++) {
        const urlObj = await this.storageService.getPresignedUploadUrl(
          FileContext.PRE_ELECTION_VIDEO,
          videoType,
          50 * 1024 * 1024,
        );
        response.videos.push(urlObj);
      }
    }

    if (response.photos.length === 0 && response.videos.length === 0) {
      throw new BadRequestException(
        'You must request at least one media upload URL (photo or video) with a valid content type.',
      );
    }

    return response;
  }

  private async resolveMediaUrls(
    report: PreElectionReport,
  ): Promise<PreElectionReport> {
    const resolvedPictureUrls = await Promise.all(
      (report.mediaPictureUrls || []).map(async (keyOrUrl) => {
        if (
          !keyOrUrl ||
          keyOrUrl.startsWith('http://') ||
          keyOrUrl.startsWith('https://')
        ) {
          return keyOrUrl;
        }
        return this.storageService.getPresignedDownloadUrl(keyOrUrl);
      }),
    );

    const resolvedVideoUrls = await Promise.all(
      (report.mediaVideoUrls || []).map(async (keyOrUrl) => {
        if (
          !keyOrUrl ||
          keyOrUrl.startsWith('http://') ||
          keyOrUrl.startsWith('https://')
        ) {
          return keyOrUrl;
        }
        return this.storageService.getPresignedDownloadUrl(keyOrUrl);
      }),
    );

    return {
      ...report,
      mediaPictureUrls: resolvedPictureUrls,
      mediaVideoUrls: resolvedVideoUrls,
    } as PreElectionReport;
  }

  async findAll(
    filters: PreElectionReportFilterDto,
    aspirantId?: number,
    user?: User,
  ): Promise<PaginatedPreElectionReportsResponse> {
    const effectiveFilters = { ...filters };

    // Default electoralOfficeId if not explicitly provided and user belongs to an aspirant campaign
    if (!effectiveFilters.electoralOfficeId && user && !isPlatformAdmin(user)) {
      const officeId =
        user.aspirant?.electoralOffice?.id ||
        user.aspirantAccount?.electoralOffice?.id;
      if (officeId) {
        effectiveFilters.electoralOfficeId = officeId;
      }
    }

    return this.preElectionReportRepository.findAll(effectiveFilters, aspirantId);
  }
}

