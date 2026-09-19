import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ElectoralOffice, OfficeCategory } from './electoral-office.entity';
import {
  CreateElectoralOfficeDto,
  UpdateElectoralOfficeDto,
  PaginationQueryDto,
} from './electoral-office.dto';
import { ElectoralOfficeRepository } from './electoral-office.repository';
import { State } from '../state/state.entity';
import { Lga } from '../lga/lga.entity';
import { Ward } from '../ward/ward.entity';
import { PollingUnit } from '../polling-unit/polling-unit.entity';
import { Aspirant } from '../aspirant/aspirant.entity';

export interface OfficeBoundaries {
  officeId: number;
  title: string;
  category: OfficeCategory;
  state?: { id: number; name: string } | null;
  lgaIds: number[];
  wardIds: number[];
  pollingUnitIds: number[];
  totalLgas: number;
  totalWards: number;
  totalPollingUnits: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class ElectoralOfficeService {
  constructor(
    private readonly officeRepository: ElectoralOfficeRepository,
    @InjectRepository(State)
    private readonly stateRepository: Repository<State>,
    @InjectRepository(Lga)
    private readonly lgaRepository: Repository<Lga>,
    @InjectRepository(Ward)
    private readonly wardRepository: Repository<Ward>,
    @InjectRepository(PollingUnit)
    private readonly puRepository: Repository<PollingUnit>,
    @InjectRepository(Aspirant)
    private readonly aspirantRepository: Repository<Aspirant>,
  ) {}

  getCategories(): OfficeCategory[] {
    return Object.values(OfficeCategory);
  }

  async create(dto: CreateElectoralOfficeDto): Promise<ElectoralOffice> {
    let state: State | null = null;
    let lgas: Lga[] = [];
    let wards: Ward[] = [];

    // All categories other than PRESIDENTIAL require a valid stateId
    if (dto.category !== OfficeCategory.PRESIDENTIAL) {
      if (!dto.stateId) {
        throw new BadRequestException(
          `State ID is required for ${dto.category} electoral office`,
        );
      }
      state = await this.stateRepository.findOne({
        where: { id: dto.stateId },
      });
      if (!state) {
        throw new NotFoundException(`State with ID ${dto.stateId} not found`);
      }
    }

    // Category-first branching & validation
    switch (dto.category) {
      case OfficeCategory.PRESIDENTIAL: {
        // Country-wide: ignore state, lga, and ward parameters
        state = null;
        lgas = [];
        wards = [];
        break;
      }

      case OfficeCategory.GUBERNATORIAL: {
        // Gubernatorial is defined at State level; ignore any passed lgas or wards
        lgas = [];
        wards = [];
        break;
      }

      case OfficeCategory.SENATORIAL: {
        if (!dto.lgaIds || dto.lgaIds.length === 0) {
          throw new BadRequestException(
            'At least one LGA must be assigned for Senatorial electoral office',
          );
        }
        lgas = await this.lgaRepository.findBy({
          id: In(dto.lgaIds),
          state: { id: dto.stateId },
        });
        if (lgas.length !== dto.lgaIds.length) {
          throw new BadRequestException(
            'One or more LGA IDs are invalid or do not belong to the specified state',
          );
        }
        // Senatorial boundaries are LGA-based; ignore any passed wards
        wards = [];
        break;
      }

      case OfficeCategory.REPS:
      case OfficeCategory.STATE_HOUSE: {
        const hasLgas = dto.lgaIds && dto.lgaIds.length > 0;
        const hasWards = dto.wardIds && dto.wardIds.length > 0;

        if (!hasLgas && !hasWards) {
          throw new BadRequestException(
            `At least one Ward or LGA must be assigned for ${dto.category} electoral office`,
          );
        }

        if (hasLgas && dto.lgaIds) {
          lgas = await this.lgaRepository.findBy({
            id: In(dto.lgaIds),
            state: { id: dto.stateId },
          });
          if (lgas.length !== dto.lgaIds.length) {
            throw new BadRequestException(
              'One or more LGA IDs are invalid or do not belong to the specified state',
            );
          }
        }

        if (hasWards && dto.wardIds) {
          wards = await this.wardRepository.find({
            where: {
              id: In(dto.wardIds),
              lga: { state: { id: dto.stateId } },
            },
            relations: { lga: { state: true } },
          });
          if (wards.length !== dto.wardIds.length) {
            throw new BadRequestException(
              'One or more Ward IDs are invalid or do not belong to the specified state',
            );
          }
        }
        break;
      }
    }

    return this.officeRepository.create({
      title: dto.title.trim(),
      category: dto.category,
      state: state || undefined,
      lgas,
      wards,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });
  }

  async findAll(): Promise<ElectoralOffice[]> {
    return this.officeRepository.findAll();
  }

  async findOne(id: number): Promise<ElectoralOffice> {
    const office = await this.officeRepository.findOne(id);
    if (!office) {
      throw new NotFoundException(`Electoral Office with ID ${id} not found`);
    }
    return office;
  }

  async findByCategory(
    category: OfficeCategory,
    isActive?: boolean,
  ): Promise<ElectoralOffice[]> {
    return this.officeRepository.findByCategory(category, isActive);
  }

  async update(
    id: number,
    dto: UpdateElectoralOfficeDto,
  ): Promise<ElectoralOffice> {
    const office = await this.findOne(id);

    if (dto.title !== undefined) {
      office.title = dto.title.trim();
    }
    if (dto.category !== undefined) {
      office.category = dto.category;
    }
    if (dto.isActive !== undefined) {
      office.isActive = dto.isActive;
    }

    const effectiveCategory = dto.category || office.category;

    if (effectiveCategory === OfficeCategory.PRESIDENTIAL) {
      office.state = null as unknown as State;
      office.lgas = [];
      office.wards = [];
    } else {
      let stateIdToUse = dto.stateId || office.state?.id;
      if (!stateIdToUse && dto.stateId === undefined && !office.state) {
        throw new BadRequestException(
          `State ID is required for ${effectiveCategory} electoral office`,
        );
      }

      if (dto.stateId !== undefined) {
        const state = await this.stateRepository.findOne({
          where: { id: dto.stateId },
        });
        if (!state) {
          throw new NotFoundException(`State with ID ${dto.stateId} not found`);
        }
        office.state = state;
        stateIdToUse = state.id;
      }

      switch (effectiveCategory) {
        case OfficeCategory.GUBERNATORIAL: {
          office.lgas = [];
          office.wards = [];
          break;
        }

        case OfficeCategory.SENATORIAL: {
          if (dto.lgaIds !== undefined) {
            const lgas = await this.lgaRepository.findBy({
              id: In(dto.lgaIds),
              state: { id: stateIdToUse },
            });
            if (lgas.length !== dto.lgaIds.length) {
              throw new BadRequestException(
                'One or more LGA IDs are invalid or do not belong to the specified state',
              );
            }
            office.lgas = lgas;
          }
          office.wards = [];
          break;
        }

        case OfficeCategory.REPS:
        case OfficeCategory.STATE_HOUSE: {
          if (dto.lgaIds !== undefined) {
            const lgas = await this.lgaRepository.findBy({
              id: In(dto.lgaIds),
              state: { id: stateIdToUse },
            });
            if (lgas.length !== dto.lgaIds.length) {
              throw new BadRequestException(
                'One or more LGA IDs are invalid or do not belong to the specified state',
              );
            }
            office.lgas = lgas;
          }
          if (dto.wardIds !== undefined) {
            const wards = await this.wardRepository.find({
              where: {
                id: In(dto.wardIds),
                lga: { state: { id: stateIdToUse } },
              },
              relations: { lga: { state: true } },
            });
            if (wards.length !== dto.wardIds.length) {
              throw new BadRequestException(
                'One or more Ward IDs are invalid or do not belong to the specified state',
              );
            }
            office.wards = wards;
          }
          break;
        }
      }
    }

    return this.officeRepository.save(office);
  }

  async remove(id: number): Promise<ElectoralOffice> {
    const office = await this.findOne(id);
    const removed = await this.officeRepository.remove(id);
    if (!removed) {
      return office;
    }
    return removed;
  }

  async getOfficeBoundaries(officeId: number): Promise<OfficeBoundaries> {
    const office = await this.findOne(officeId);

    let lgaIds: number[] = [];
    let wardIds: number[] = [];
    let pollingUnitIds: number[] = [];

    switch (office.category) {
      case OfficeCategory.GUBERNATORIAL: {
        if (!office.state) {
          throw new BadRequestException(
            'Office does not have a state assigned',
          );
        }
        const stateLgas = await this.lgaRepository.find({
          where: { state: { id: office.state.id } },
          select: { id: true },
        });
        lgaIds = stateLgas.map((l) => l.id);

        if (lgaIds.length > 0) {
          const lgaWards = await this.wardRepository.find({
            where: { lga: { id: In(lgaIds) } },
            select: { id: true },
          });
          wardIds = lgaWards.map((w) => w.id);
        }
        break;
      }

      case OfficeCategory.SENATORIAL: {
        lgaIds = (office.lgas || []).map((l) => l.id);
        if (lgaIds.length > 0) {
          const lgaWards = await this.wardRepository.find({
            where: { lga: { id: In(lgaIds) } },
            select: { id: true },
          });
          wardIds = lgaWards.map((w) => w.id);
        }
        break;
      }

      case OfficeCategory.REPS:
      case OfficeCategory.STATE_HOUSE: {
        const directWardIds = (office.wards || []).map((w) => w.id);
        const directLgaIds = (office.lgas || []).map((l) => l.id);

        let lgaWards: { id: number }[] = [];
        if (directLgaIds.length > 0) {
          lgaWards = await this.wardRepository.find({
            where: { lga: { id: In(directLgaIds) } },
            select: { id: true },
          });
        }

        wardIds = Array.from(
          new Set([...directWardIds, ...lgaWards.map((w) => w.id)]),
        );

        if (directLgaIds.length > 0) {
          lgaIds = directLgaIds;
        } else if (wardIds.length > 0) {
          const wardsWithLga = await this.wardRepository.find({
            where: { id: In(wardIds) },
            relations: { lga: true },
          });
          lgaIds = Array.from(
            new Set(
              wardsWithLga
                .map((w) => w.lga?.id)
                .filter((id): id is number => id !== undefined),
            ),
          );
        }
        break;
      }

      case OfficeCategory.PRESIDENTIAL: {
        const allLgas = await this.lgaRepository.find({
          select: { id: true },
        });
        lgaIds = allLgas.map((l) => l.id);
        const allWards = await this.wardRepository.find({
          select: { id: true },
        });
        wardIds = allWards.map((w) => w.id);
        break;
      }
    }

    if (wardIds.length > 0) {
      const pus = await this.puRepository.find({
        where: { ward: { id: In(wardIds) } },
        select: { id: true },
      });
      pollingUnitIds = pus.map((p) => p.id);
    }

    return {
      officeId: office.id,
      title: office.title,
      category: office.category,
      state: office.state
        ? { id: office.state.id, name: office.state.name }
        : null,
      lgaIds,
      wardIds,
      pollingUnitIds,
      totalLgas: lgaIds.length,
      totalWards: wardIds.length,
      totalPollingUnits: pollingUnitIds.length,
    };
  }

  async getAspirantBoundaries(aspirantId: number): Promise<OfficeBoundaries> {
    const aspirant = await this.aspirantRepository.findOne({
      where: { id: aspirantId },
      relations: { electoralOffice: true },
    });

    if (!aspirant) {
      throw new NotFoundException(`Aspirant with ID ${aspirantId} not found`);
    }

    if (!aspirant.electoralOffice) {
      throw new BadRequestException(
        'Aspirant is not assigned to any electoral office',
      );
    }

    return this.getOfficeBoundaries(aspirant.electoralOffice.id);
  }

  async validateStationWithinBoundary(
    officeId: number,
    station: { lgaId?: number; wardId?: number; puId?: number },
  ): Promise<boolean> {
    const boundaries = await this.getOfficeBoundaries(officeId);

    if (
      station.lgaId !== undefined &&
      !boundaries.lgaIds.includes(station.lgaId)
    ) {
      return false;
    }

    if (
      station.wardId !== undefined &&
      !boundaries.wardIds.includes(station.wardId)
    ) {
      return false;
    }

    if (
      station.puId !== undefined &&
      !boundaries.pollingUnitIds.includes(station.puId)
    ) {
      return false;
    }

    return true;
  }

  // --- Paginated Geographic Object Endpoints ---

  async getOfficeStates(officeId: number): Promise<State[]> {
    const office = await this.findOne(officeId);

    if (office.category === OfficeCategory.PRESIDENTIAL) {
      return this.stateRepository.find({ order: { name: 'ASC' } });
    }

    if (office.state) {
      const state = await this.stateRepository.findOne({
        where: { id: office.state.id },
      });
      return state ? [state] : [];
    }

    // If state is not directly linked, resolve via LGAs or Wards
    const boundaries = await this.getOfficeBoundaries(officeId);
    if (boundaries.lgaIds.length > 0) {
      const lgas = await this.lgaRepository.find({
        where: { id: In(boundaries.lgaIds) },
        relations: { state: true },
      });
      const uniqueStateMap = new Map<number, State>();
      lgas.forEach((l) => {
        if (l.state) uniqueStateMap.set(l.state.id, l.state);
      });
      return Array.from(uniqueStateMap.values());
    }

    return [];
  }

  async getOfficeLgas(
    officeId: number,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResult<Lga>> {
    const boundaries = await this.getOfficeBoundaries(officeId);

    if (boundaries.lgaIds.length === 0) {
      return {
        data: [],
        total: 0,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: 0,
      };
    }

    const [data, total] = await this.lgaRepository.findAndCount({
      where: { id: In(boundaries.lgaIds) },
      relations: { state: true },
      order: { name: 'ASC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });

    return {
      data,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async getOfficeWards(
    officeId: number,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResult<Ward>> {
    const boundaries = await this.getOfficeBoundaries(officeId);

    if (boundaries.wardIds.length === 0) {
      return {
        data: [],
        total: 0,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: 0,
      };
    }

    const [data, total] = await this.wardRepository.findAndCount({
      where: { id: In(boundaries.wardIds) },
      relations: { lga: true },
      order: { name: 'ASC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });

    return {
      data,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async getOfficePollingUnits(
    officeId: number,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResult<PollingUnit>> {
    const boundaries = await this.getOfficeBoundaries(officeId);

    if (boundaries.pollingUnitIds.length === 0) {
      return {
        data: [],
        total: 0,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: 0,
      };
    }

    const [data, total] = await this.puRepository.findAndCount({
      where: { id: In(boundaries.pollingUnitIds) },
      relations: { ward: true },
      order: { name: 'ASC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });

    return {
      data,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }
}
