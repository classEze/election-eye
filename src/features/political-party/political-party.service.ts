import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PoliticalPartyRepository } from './political-party.repository';
import {
  CreatePoliticalPartyDto,
  PoliticalPartyQueryDto,
  UpdatePartyLogoDto,
  UpdatePoliticalPartyDto,
} from './political-party.dto';
import { PoliticalParty } from './political-party.entity';
import { StorageService } from '../../shared/storage/storage.service';

const PARTY_CACHE_PREFIX = 'political_parties:';

@Injectable()
export class PoliticalPartyService {
  constructor(
    private readonly repository: PoliticalPartyRepository,
    private readonly storageService: StorageService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async findAll(queryDto?: PoliticalPartyQueryDto): Promise<PoliticalParty[]> {
    const activeFilter =
      queryDto?.is_active !== undefined
        ? queryDto.is_active
        : queryDto?.isActive !== undefined
          ? queryDto.isActive
          : 'all';

    const cacheKey = `${PARTY_CACHE_PREFIX}list:${activeFilter}:${queryDto?.search || 'none'}`;
    const cached = await this.cacheManager.get<PoliticalParty[]>(cacheKey);
    if (cached) return cached;

    const parties = await this.repository.findAll(queryDto);
    await this.cacheManager.set(cacheKey, parties, 1000 * 60 * 15); // 15 mins TTL
    return parties;
  }

  async findOne(id: number): Promise<PoliticalParty> {
    const party = await this.repository.findById(id);
    if (!party) {
      throw new NotFoundException(`Political Party with ID #${id} not found.`);
    }
    return party;
  }

  async create(
    dto: CreatePoliticalPartyDto,
    file?: Express.Multer.File,
  ): Promise<PoliticalParty> {
    // 1. Verify Code Uniqueness
    const existing = await this.repository.findByCode(dto.code);
    if (existing) {
      throw new ConflictException(
        `A political party with code "${dto.code}" already exists.`,
      );
    }

    // 2. Handle Logo Upload via S3 Storage Service
    let logoUrl = dto.logoUrl;
    if (file) {
      logoUrl = await this.storageService.uploadFile(
        file,
        'political-parties/logos',
      );
    }

    // 3. Persist Entity
    const party = await this.repository.create(dto, logoUrl);

    // 4. Invalidate Cache
    await this.invalidatePartyCache();

    return party;
  }

  async update(
    id: number,
    dto: UpdatePoliticalPartyDto,
  ): Promise<PoliticalParty> {
    const existing = await this.findOne(id);

    // If updating code, ensure uniqueness
    if (dto.code && dto.code.toUpperCase() !== existing.code.toUpperCase()) {
      const duplicate = await this.repository.findByCode(dto.code);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(
          `A political party with code "${dto.code}" already exists.`,
        );
      }
    }

    const updated = await this.repository.update(id, dto);
    await this.invalidatePartyCache();
    return updated!;
  }

  async updateLogo(
    id: number,
    dto?: UpdatePartyLogoDto,
    file?: Express.Multer.File,
  ): Promise<PoliticalParty> {
    await this.findOne(id);

    let logoUrl = dto?.logoUrl;
    if (file) {
      logoUrl = await this.storageService.uploadFile(
        file,
        'political-parties/logos',
      );
    }

    if (!logoUrl) {
      throw new BadRequestException(
        'Please provide a logo image file to upload or a valid logoUrl in the request body.',
      );
    }

    const updated = await this.repository.updateLogo(id, logoUrl);
    await this.invalidatePartyCache();
    return updated!;
  }

  async softDelete(id: number): Promise<{ message: string }> {
    await this.findOne(id);
    const success = await this.repository.softDelete(id);
    if (!success) {
      throw new NotFoundException(`Political party with ID #${id} could not be deleted.`);
    }

    await this.invalidatePartyCache();
    return {
      message: `Political party with ID #${id} was successfully soft-deleted.`,
    };
  }

  private async invalidatePartyCache(): Promise<void> {
    // Delete known list cache variations
    await this.cacheManager.del(`${PARTY_CACHE_PREFIX}list:all:none`);
    await this.cacheManager.del(`${PARTY_CACHE_PREFIX}list:true:none`);
    await this.cacheManager.del(`${PARTY_CACHE_PREFIX}list:false:none`);
  }
}
