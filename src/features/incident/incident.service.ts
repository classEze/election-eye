import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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
import { RoleCode } from '../role/role.enum';
import { PollingUnit } from '../polling-unit/polling-unit.entity';
import { Ward } from '../ward/ward.entity';
import { Lga } from '../lga/lga.entity';
import { ElectoralOfficeService } from '../electoral-office/electoral-office.service';
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
    @InjectRepository(PollingUnit)
    private readonly puRepository: Repository<PollingUnit>,
    @InjectRepository(Ward)
    private readonly wardRepository: Repository<Ward>,
    @InjectRepository(Lga)
    private readonly lgaRepository: Repository<Lga>,
    private readonly electoralOfficeService: ElectoralOfficeService,
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
    const userRoleCode = user.role?.code;
    const permittedUploadRoles = [
      RoleCode.PU_AGENT,
      RoleCode.WARD_COORDINATOR,
      RoleCode.LGA_COORDINATOR,
    ];

    if (!permittedUploadRoles.includes(userRoleCode as any)) {
      throw new ForbiddenException(
        'Only Polling Unit Agents, Ward Coordinators, and LGA Coordinators are permitted to report incidents.',
      );
    }

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
      throw new BadRequestException(
        `Exceeded video limit: Maximum allowed is ${MAX_VIDEO_COUNT} videos.`,
      );
    }

    const uploadedPictureKeys = dto.mediaPictureKeys || [];
    if (uploadedPictureKeys.length > MAX_PICTURE_COUNT) {
      throw new BadRequestException(
        `Exceeded picture limit: Maximum allowed is ${MAX_PICTURE_COUNT} pictures.`,
      );
    }

    // 3. Hierarchical Location & Boundary Resolution
    let puId: number | null = null;
    let wardId: number | null = null;
    let lgaId: number | null = null;

    if (userRoleCode === RoleCode.PU_AGENT) {
      if (!user.assignedPu?.id) {
        throw new BadRequestException(
          'Authenticated Polling Unit Agent is not assigned to any Polling Unit.',
        );
      }
      if (dto.pollingUnitId && dto.pollingUnitId !== user.assignedPu.id) {
        throw new ForbiddenException(
          'Polling Unit Agents can only report incidents for their assigned Polling Unit.',
        );
      }
      puId = user.assignedPu.id;
      const pu = await this.puRepository.findOne({
        where: { id: puId },
        relations: { ward: { lga: true } },
      });
      if (pu) {
        wardId = pu.ward?.id || null;
        lgaId = pu.ward?.lga?.id || null;
      }
    } else if (userRoleCode === RoleCode.WARD_COORDINATOR) {
      if (!user.assignedWard?.id) {
        throw new BadRequestException(
          'Authenticated Ward Coordinator is not assigned to any Ward.',
        );
      }
      wardId = user.assignedWard.id;
      if (dto.pollingUnitId) {
        const pu = await this.puRepository.findOne({
          where: { id: dto.pollingUnitId },
          relations: { ward: { lga: true } },
        });
        if (!pu) {
          throw new NotFoundException(
            `Polling Unit with ID #${dto.pollingUnitId} not found.`,
          );
        }
        if (pu.ward?.id !== wardId) {
          throw new ForbiddenException(
            'The selected Polling Unit does not fall within your assigned Ward.',
          );
        }
        puId = dto.pollingUnitId;
        lgaId = pu.ward?.lga?.id || null;
      } else {
        const ward = await this.wardRepository.findOne({
          where: { id: wardId },
          relations: { lga: true },
        });
        lgaId = ward?.lga?.id || null;
      }
    } else if (userRoleCode === RoleCode.LGA_COORDINATOR) {
      if (!user.assignedLga?.id) {
        throw new BadRequestException(
          'Authenticated LGA Coordinator is not assigned to any LGA.',
        );
      }
      lgaId = user.assignedLga.id;
      if (dto.pollingUnitId) {
        const pu = await this.puRepository.findOne({
          where: { id: dto.pollingUnitId },
          relations: { ward: { lga: true } },
        });
        if (!pu) {
          throw new NotFoundException(
            `Polling Unit with ID #${dto.pollingUnitId} not found.`,
          );
        }
        if (pu.ward?.lga?.id !== lgaId) {
          throw new ForbiddenException(
            'The selected Polling Unit does not fall within your assigned LGA.',
          );
        }
        puId = dto.pollingUnitId;
        wardId = pu.ward?.id || null;
      } else if (dto.wardId) {
        const ward = await this.wardRepository.findOne({
          where: { id: dto.wardId },
          relations: { lga: true },
        });
        if (!ward) {
          throw new NotFoundException(`Ward with ID #${dto.wardId} not found.`);
        }
        if (ward.lga?.id !== lgaId) {
          throw new ForbiddenException(
            'The selected Ward does not fall within your assigned LGA.',
          );
        }
        wardId = dto.wardId;
      }
    }

    const aspirant = user.aspirant || user.aspirantAccount;
    const aspirantId = aspirant?.id || dto.aspirantId;
    const partyId = aspirant?.politicalParty?.id || dto.politicalPartyId;

    // Office boundaries verification if aspirant has an assigned office
    if (aspirant?.electoralOffice?.id) {
      const boundaries = await this.electoralOfficeService.getOfficeBoundaries(
        aspirant.electoralOffice.id,
      );
      if (puId && !boundaries.pollingUnitIds.includes(puId)) {
        throw new BadRequestException(
          `Polling Unit #${puId} is outside your campaign electoral office boundaries.`,
        );
      }
      if (wardId && !boundaries.wardIds.includes(wardId)) {
        throw new BadRequestException(
          `Ward #${wardId} is outside your campaign electoral office boundaries.`,
        );
      }
      if (lgaId && !boundaries.lgaIds.includes(lgaId)) {
        throw new BadRequestException(
          `LGA #${lgaId} is outside your campaign electoral office boundaries.`,
        );
      }
    }

    // 4. Save Incident
    return this.incidentRepository.create(
      dto,
      user,
      uploadedVideoKeys,
      uploadedPictureKeys,
      partyId,
      aspirantId,
      puId || undefined,
      wardId || undefined,
      lgaId || undefined,
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
    actor?: User,
  ): Promise<Incident> {
    const incident = await this.incidentRepository.findById(id);
    if (!incident) {
      throw new NotFoundException(`Incident with ID #${id} not found.`);
    }

    if (actor) {
      const isPlatformAdmin =
        actor.role?.code === RoleCode.SUPER_ADMIN ||
        actor.role?.code === RoleCode.SYSTEM_ADMIN;

      if (!isPlatformAdmin) {
        const actorAspirantId =
          actor.aspirantAccount?.id || actor.aspirant?.id;
        if (
          !actorAspirantId ||
          (incident.aspirant?.id && incident.aspirant.id !== actorAspirantId)
        ) {
          throw new ForbiddenException(
            'You can only update incident statuses within your own campaign.',
          );
        }
      }
    }

    const updated = await this.incidentRepository.updateStatus(id, dto.status);
    return updated!;
  }

  async remove(id: number, actor?: User): Promise<{ message: string }> {
    const incident = await this.incidentRepository.findById(id);
    if (!incident) {
      throw new NotFoundException(`Incident with ID #${id} not found.`);
    }

    if (actor) {
      const isPlatformAdmin =
        actor.role?.code === RoleCode.SUPER_ADMIN ||
        actor.role?.code === RoleCode.SYSTEM_ADMIN;

      if (!isPlatformAdmin) {
        const actorAspirantId =
          actor.aspirantAccount?.id || actor.aspirant?.id;
        if (
          !actorAspirantId ||
          (incident.aspirant?.id && incident.aspirant.id !== actorAspirantId)
        ) {
          throw new ForbiddenException(
            'You can only delete incidents within your own campaign.',
          );
        }
      }
    }

    await this.incidentRepository.remove(id);
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
