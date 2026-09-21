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
const MAX_PICTURE_COUNT = 5;
const MAX_VIDEO_SIZE = 25 * 1024 * 1024; // 25MB per video
const MAX_PICTURE_SIZE = 5 * 1024 * 1024; // 5MB per picture

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
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async createIncident(
    dto: CreateIncidentDto,
    user: User,
    files?: {
      videos?: Express.Multer.File[];
      pictures?: Express.Multer.File[];
    },
  ): Promise<Incident> {
    // 1. Verify Category Exists
    const category = await this.categoryRepository.findOne({
      where: { id: dto.categoryId, isActive: true },
    });
    if (!category) {
      throw new NotFoundException(
        `Active incident category #${dto.categoryId} not found.`,
      );
    }

    // 2. Process Videos (Max 2 videos with size check)
    const uploadedVideoUrls = [...(dto.mediaVideoUrls || [])];
    if (files?.videos && files.videos.length > 0) {
      if (files.videos.length + uploadedVideoUrls.length > MAX_VIDEO_COUNT) {
        throw new BadRequestException(
          `Exceeded video limit: Maximum allowed is ${MAX_VIDEO_COUNT} videos.`,
        );
      }
      for (const video of files.videos) {
        if (video.size > MAX_VIDEO_SIZE) {
          throw new BadRequestException(
            `Video "${video.originalname}" exceeds maximum size of 25MB.`,
          );
        }
      }
      const s3Urls = await this.storageService.uploadFiles(
        files.videos,
        'incidents/videos',
      );
      uploadedVideoUrls.push(...s3Urls);
    }

    // 3. Process Pictures (Max 5 pictures with size check)
    const uploadedPictureUrls = [...(dto.mediaPictureUrls || [])];
    if (files?.pictures && files.pictures.length > 0) {
      if (files.pictures.length + uploadedPictureUrls.length > MAX_PICTURE_COUNT) {
        throw new BadRequestException(
          `Exceeded picture limit: Maximum allowed is ${MAX_PICTURE_COUNT} pictures.`,
        );
      }
      for (const picture of files.pictures) {
        if (picture.size > MAX_PICTURE_SIZE) {
          throw new BadRequestException(
            `Picture "${picture.originalname}" exceeds maximum size of 5MB.`,
          );
        }
      }
      const s3Urls = await this.storageService.uploadFiles(
        files.pictures,
        'incidents/pictures',
      );
      uploadedPictureUrls.push(...s3Urls);
    }

    // 4. Save Incident
    return this.incidentRepository.create(
      dto,
      user,
      uploadedVideoUrls,
      uploadedPictureUrls,
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
    return this.incidentRepository.findByElectoralOffice(
      officeId,
      page,
      limit,
    );
  }

  async findMapClusters(query: IncidentMapClusterQueryDto): Promise<Incident[]> {
    return this.incidentRepository.findMapClusters(query);
  }

  async updateStatus(
    id: number,
    dto: UpdateIncidentStatusDto,
  ): Promise<Incident> {
    const updated = await this.incidentRepository.updateStatus(
      id,
      dto.status,
    );
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
}
