import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncidentRepository } from './incident.repository';
import {
  CreateIncidentDto,
  IncidentFilterDto,
  IncidentMapClusterQueryDto,
  UpdateIncidentStatusDto,
} from './incident.dto';
import { Incident, IncidentStatus } from './incident.entity';
import { IncidentCategory } from '../../shared/entities/incident-category.entity';
import { User } from '../user/user.entity';
import { StorageService } from '../../shared/storage/storage.service';

const MAX_VIDEO_COUNT = 2;
const MAX_PICTURE_COUNT = 2;

import { UserStatus } from '../../shared/enums/status.enum';

@Injectable()
export class IncidentService {
  constructor(
    private readonly incidentRepository: IncidentRepository,
    @InjectRepository(IncidentCategory)
    private readonly categoryRepository: Repository<IncidentCategory>,
    private readonly storageService: StorageService,
  ) {}

  async getCategories(): Promise<IncidentCategory[]> {
    return this.categoryRepository.find({
      where: { status: UserStatus.ACTIVE },
      order: { name: 'ASC' },
    });
  }

  async createIncident(
    dto: CreateIncidentDto,
    user: User,
  ): Promise<Incident> {
    // 1. Verify Category Exists
    const category = await this.categoryRepository.findOne({
      where: { id: dto.categoryId, status: UserStatus.ACTIVE },
    });
    if (!category) {
      throw new NotFoundException(
        `Active incident category #${dto.categoryId} not found.`,
      );
    }

    // 2. Validate max files
    const uploadedVideoKeys = dto.mediaVideoKeys || [];
    if (uploadedVideoKeys.length > MAX_VIDEO_COUNT) {
      throw new BadRequestException(`Exceeded video limit: Maximum allowed is ${MAX_VIDEO_COUNT} videos.`);
    }

    const uploadedPictureKeys = dto.mediaPictureKeys || [];
    if (uploadedPictureKeys.length > MAX_PICTURE_COUNT) {
      throw new BadRequestException(`Exceeded picture limit: Maximum allowed is ${MAX_PICTURE_COUNT} pictures.`);
    }

    // Resolve Context from User Object fallback to DTO
    const puId = user.assignedPu?.id || dto.pollingUnitId;
    const partyId = user.aspirant?.politicalParty?.id || dto.politicalPartyId;
    const aspirantId = user.aspirant?.id || dto.aspirantId;

    // 3. Save Incident
    return this.incidentRepository.create(
      dto,
      user,
      uploadedVideoKeys,
      uploadedPictureKeys,
      partyId,
      aspirantId,
      puId,
    );
  }

  async findOne(id: number): Promise<Incident> {
    const incident = await this.incidentRepository.findById(id);
    if (!incident) {
      throw new NotFoundException(`Incident with ID #${id} not found.`);
    }
    return incident;
  }

  async findAll(filters: IncidentFilterDto) {
    return this.incidentRepository.findAll(filters);
  }

  async findByElectoralOffice(officeId: number, page = 1, limit = 20) {
    return this.incidentRepository.findByElectoralOffice(officeId, page, limit);
  }

  async findMapClusters(
    query: IncidentMapClusterQueryDto,
  ): Promise<Incident[]> {
    return this.incidentRepository.findMapClusters(query);
  }

  async updateStatus(
    id: number,
    dto: UpdateIncidentStatusDto,
  ): Promise<Incident> {
    const updated = await this.incidentRepository.updateStatus(id, dto.status);
    if (!updated) {
      throw new NotFoundException(`Incident with ID #${id} not found.`);
    }
    return updated;
  }

  async remove(id: number): Promise<{ message: string }> {
    const removed = await this.incidentRepository.remove(id);
    if (!removed) {
      throw new NotFoundException(`Incident with ID #${id} not found.`);
    }
    return { message: `Incident #${id} successfully removed.` };
  }

  async getMediaUploadUrls(requestPhotoCount: number, requestVideoCount: number, photoContentType?: string, videoContentType?: string) {
    const response: any = { photos: [], videos: [] };
    
    if (requestPhotoCount > 0 && photoContentType) {
      if (!photoContentType.startsWith('image/')) {
        throw new BadRequestException('Incident photos must be an image type.');
      }
      if (requestPhotoCount > MAX_PICTURE_COUNT) {
        throw new BadRequestException(`Maximum allowed is ${MAX_PICTURE_COUNT} photos.`);
      }
      for (let i = 0; i < requestPhotoCount; i++) {
        const url = await this.storageService.getPresignedUploadUrl(
          'incidents/pictures' as any, // FileContext equivalent
          photoContentType,
          10 * 1024 * 1024,
        );
        response.photos.push(url);
      }
    }
    
    if (requestVideoCount > 0 && videoContentType) {
      if (!videoContentType.startsWith('video/')) {
        throw new BadRequestException('Incident videos must be a video type.');
      }
      if (requestVideoCount > MAX_VIDEO_COUNT) {
        throw new BadRequestException(`Maximum allowed is ${MAX_VIDEO_COUNT} videos.`);
      }
      for (let i = 0; i < requestVideoCount; i++) {
        const url = await this.storageService.getPresignedUploadUrl(
          'incidents/videos' as any, // FileContext equivalent
          videoContentType,
          50 * 1024 * 1024,
        );
        response.videos.push(url);
      }
    }

    if (response.photos.length === 0 && response.videos.length === 0) {
      throw new BadRequestException('You must request at least one media upload URL (photo or video) with a valid content type.');
    }

    return response;
  }
}
