import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ResultRepository } from './result.repository';
import {
  CreateResultDto,
  ResultFilterDto,
  VerifyResultDto,
} from './result.dto';
import { Result } from './result.entity';
import { User } from '../user/user.entity';
import { StorageService, FileContext } from '../../shared/storage/storage.service';

@Injectable()
export class ResultService {
  constructor(
    private readonly resultRepository: ResultRepository,
    private readonly storageService: StorageService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async submitResult(
    dto: CreateResultDto,
    user: User,
  ): Promise<Result> {
    // 1. Validate Sum of Party Votes vs Total Valid Votes
    const partyVotesSum = dto.partyBreakdown.reduce(
      (sum, item) => sum + Number(item.votes || 0),
      0,
    );

    if (partyVotesSum !== Number(dto.totalValidVotes)) {
      throw new BadRequestException(
        `Integrity error: Total valid votes (${dto.totalValidVotes}) must strictly match the sum of individual party votes (${partyVotesSum}).`,
      );
    }

    // 2. Validate Over-voting against accredited voters if supplied
    if (
      dto.totalAccreditedVoters !== undefined &&
      dto.totalAccreditedVoters !== null
    ) {
      const totalCast =
        Number(dto.totalValidVotes) + Number(dto.rejectedVotes || 0);
      if (totalCast > Number(dto.totalAccreditedVoters)) {
        throw new BadRequestException(
          `Over-voting detected: Total votes cast (Valid ${dto.totalValidVotes} + Rejected ${dto.rejectedVotes} = ${totalCast}) exceeds accredited voters (${dto.totalAccreditedVoters}).`,
        );
      }
    }

    // Resolve Context from User Object fallback to DTO
    const puId = user.assignedPu?.id || dto.pollingUnitId;
    const partyId = user.aspirant?.politicalParty?.id || dto.politicalPartyId;
    const aspirantId = user.aspirant?.id || dto.aspirantId;

    // 3. Check for Duplicate Submissions
    const existing = await this.resultRepository.findByPollingUnitOfficeAndParty(
      puId,
      dto.electoralOfficeId,
      partyId,
    );
    if (existing) {
      throw new ConflictException(
        `A result has already been submitted for Polling Unit #${puId} and Electoral Office #${dto.electoralOfficeId} for Party #${partyId}. Duplicate submissions are blocked.`,
      );
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
    };

    const savedResult = await this.resultRepository.createTransactional(
      resultData,
      dto.partyBreakdown,
    );

    // 6. Invalidate Electoral Office Caches
    await this.invalidateOfficeCaches(dto.electoralOfficeId);

    return savedResult;
  }

  async findOne(id: number): Promise<Result> {
    const result = await this.resultRepository.findById(id);
    if (!result) {
      throw new NotFoundException(`Result with ID #${id} not found.`);
    }
    
    // Generate secure short-lived URLs for media
    const ec8aPhotoUrl = await this.storageService.getPresignedDownloadUrl(result.ec8aPhotoUrl);
    const videoUrl = result.videoUrl 
      ? await this.storageService.getPresignedDownloadUrl(result.videoUrl)
      : null;

    return {
      ...result,
      ec8aPhotoUrl,
      videoUrl
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
      throw new BadRequestException('You must request at least one media upload URL (photo or video) with a valid content type.');
    }

    return response;
  }
}
