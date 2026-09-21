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
import { StorageService } from '../../shared/storage/storage.service';

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
    file?: Express.Multer.File,
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

    // 3. Check for Duplicate Submissions
    const existing = await this.resultRepository.findByPollingUnitAndOffice(
      dto.pollingUnitId,
      dto.electoralOfficeId,
    );
    if (existing) {
      throw new ConflictException(
        `A result has already been submitted for Polling Unit #${dto.pollingUnitId} and Electoral Office #${dto.electoralOfficeId}. Duplicate submissions are blocked.`,
      );
    }

    // 4. Handle EC8A Media Upload (Simulated AWS S3 Upload)
    let ec8aPhotoUrl = dto.ec8aPhotoUrl;
    if (file) {
      ec8aPhotoUrl = await this.storageService.uploadFile(file, 'ec8a-forms');
    }

    if (!ec8aPhotoUrl) {
      throw new BadRequestException(
        'EC8A form image proof is required. Please upload the photo or provide a valid ec8aPhotoUrl.',
      );
    }

    // 5. Transactional Persistence
    const resultData: Partial<Result> = {
      electoralOffice: { id: dto.electoralOfficeId } as any,
      pollingUnit: { id: dto.pollingUnitId } as any,
      aspirant: dto.aspirantId ? ({ id: dto.aspirantId } as any) : null,
      totalRegisteredVoters: dto.totalRegisteredVoters ?? null,
      totalAccreditedVoters: dto.totalAccreditedVoters ?? null,
      totalValidVotes: Number(dto.totalValidVotes),
      rejectedVotes: Number(dto.rejectedVotes || 0),
      ec8aPhotoUrl,
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
    return result;
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

  async getOfficePartySummary(officeId: number): Promise<any> {
    const cacheKey = `office:summary:${officeId}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const summary = await this.resultRepository.getOfficePartySummary(officeId);
    await this.cacheManager.set(cacheKey, summary, 1000 * 30); // 30s TTL
    return summary;
  }

  async getOfficeWardReport(officeId: number, wardId: number): Promise<any> {
    const cacheKey = `office:report:${officeId}:ward:${wardId}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const report = await this.resultRepository.getOfficeWardReport(
      officeId,
      wardId,
    );
    await this.cacheManager.set(cacheKey, report, 1000 * 30);
    return report;
  }

  async getOfficeLgaReport(officeId: number, lgaId: number): Promise<any> {
    const cacheKey = `office:report:${officeId}:lga:${lgaId}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const report = await this.resultRepository.getOfficeLgaReport(
      officeId,
      lgaId,
    );
    await this.cacheManager.set(cacheKey, report, 1000 * 30);
    return report;
  }

  async getOfficeStateReport(officeId: number, stateId: number): Promise<any> {
    const cacheKey = `office:report:${officeId}:state:${stateId}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const report = await this.resultRepository.getOfficeStateReport(
      officeId,
      stateId,
    );
    await this.cacheManager.set(cacheKey, report, 1000 * 30);
    return report;
  }

  async getOfficeUploadProgress(officeId: number): Promise<any> {
    const cacheKey = `office:progress:${officeId}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const progress = await this.resultRepository.getOfficeUploadProgress(
      officeId,
    );
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
}
