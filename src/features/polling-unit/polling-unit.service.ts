import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PollingUnit } from './polling-unit.entity';
import {
  CreatePollingUnitDto,
  UpdatePollingUnitDto,
  CreatePollingUnitArrayDto,
} from './polling-unit.dto';
import { PollingUnitRepository } from './polling-unit.repository';
import * as Papa from 'papaparse';
import { uploadDataRows } from './polling-unit.data';
import { InjectQueue } from '@nestjs/bullmq';
import {
  APP_QUEUES,
  QueueDictionary,
} from '../../shared/constants/queue.constants';
import { Queue } from 'bullmq';
import { User } from '../user/user.entity';
import { WardService } from '../ward/ward.service';

@Injectable()
export class PollingUnitService {
  constructor(
    private readonly pollingUnitRepository: PollingUnitRepository,
    private readonly wardService: WardService,
    @InjectQueue(APP_QUEUES.file) private fileQueue: Queue,
  ) {}

  generateTemplate(): string {
    return Papa.unparse(uploadDataRows);
  }

  async uploadPollingUnits(
    file: Express.Multer.File,
    wardId: number,
    user: User,
  ): Promise<{ message: string }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file uploaded');
    }

    if (!wardId || isNaN(wardId)) {
      throw new BadRequestException('A valid Ward ID must be provided');
    }

    // Validate Ward ID against the database
    await this.wardService.findOne(wardId);

    this.validateCsvFile(file);

    await this.fileQueue.add(
      QueueDictionary.PROCESS_POLLING_UNIT_UPLOAD_WITH_WARD_ID,
      {
        csvData: file.buffer.toString('utf-8').trim(),
        wardId,
        userEmail: user.emailAddress,
      },
    );

    return {
      message:
        'File uploaded successfully. You will receive an email once processing is complete.',
    };
  }

  async uploadPollingUnitsGeneric(
    file: Express.Multer.File,
    user: User,
  ): Promise<{ message: string }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file uploaded');
    }

    this.validateCsvFile(file);

    await this.fileQueue.add(
      QueueDictionary.PROCESS_POLLING_UNIT_UPLOAD_GENERIC,
      {
        csvData: file.buffer.toString('utf-8').trim(),
        userEmail: user.emailAddress,
      },
    );

    return {
      message:
        'File uploaded successfully. You will receive an email once processing is complete.',
    };
  }

  private validateCsvFile(file: Express.Multer.File): void {
    const allowedMimeTypes = [
      'text/csv',
      'text/plain',
      'application/vnd.ms-excel',
      'application/csv',
      'text/x-csv',
      'application/x-csv',
      'text/comma-separated-values',
    ];
    const originalName = file.originalname?.toLowerCase() || '';
    const hasValidExtension = originalName.endsWith('.csv');
    const hasValidMimeType =
      !file.mimetype || allowedMimeTypes.includes(file.mimetype.toLowerCase());

    if (!hasValidExtension && !hasValidMimeType) {
      throw new BadRequestException(
        'Invalid file format. Only CSV files (.csv) are allowed',
      );
    }
  }

  async create(createPollingUnitDto: CreatePollingUnitDto): Promise<PollingUnit> {
    await this.wardService.findOne(createPollingUnitDto.wardId);

    const existingName = await this.pollingUnitRepository.findByNameAndWard(
      createPollingUnitDto.name.trim(),
      createPollingUnitDto.wardId,
    );
    if (existingName) {
      throw new BadRequestException(
        `Polling Unit with name "${createPollingUnitDto.name}" already exists in this Ward`,
      );
    }

    const existingCode = await this.pollingUnitRepository.findByPuCode(
      createPollingUnitDto.puCode.trim(),
    );
    if (existingCode) {
      throw new BadRequestException(
        `Polling Unit with code "${createPollingUnitDto.puCode}" already exists`,
      );
    }

    return this.pollingUnitRepository.create({
      ...createPollingUnitDto,
      name: createPollingUnitDto.name.trim(),
      puCode: createPollingUnitDto.puCode.trim(),
    });
  }

  async createMultiple(
    createPollingUnitArrayDto: CreatePollingUnitArrayDto,
  ): Promise<PollingUnit[]> {
    await this.wardService.findOne(createPollingUnitArrayDto.wardId);

    const unitsToInsert = createPollingUnitArrayDto.pollingUnits.map((pu) => ({
      name: pu.name.trim(),
      puCode: pu.puCode.trim(),
      registeredVoters: pu.registeredVoters,
      wardId: createPollingUnitArrayDto.wardId,
    }));

    await this.pollingUnitRepository.bulkInsert(unitsToInsert);
    return this.findByWard(createPollingUnitArrayDto.wardId);
  }

  async findAll(): Promise<PollingUnit[]> {
    return this.pollingUnitRepository.findAll();
  }

  async findByWard(wardId: number): Promise<PollingUnit[]> {
    await this.wardService.findOne(wardId);
    return this.pollingUnitRepository.findByWard(wardId);
  }

  async findOne(id: number): Promise<PollingUnit> {
    const pu = await this.pollingUnitRepository.findOne(id);
    if (!pu) {
      throw new NotFoundException(`Polling Unit with ID ${id} not found`);
    }
    return pu;
  }

  async update(
    id: number,
    updatePollingUnitDto: UpdatePollingUnitDto,
  ): Promise<PollingUnit> {
    await this.findOne(id);

    if (updatePollingUnitDto.wardId !== undefined) {
      await this.wardService.findOne(updatePollingUnitDto.wardId);
    }

    const updated = await this.pollingUnitRepository.update(id, {
      ...updatePollingUnitDto,
      name: updatePollingUnitDto.name?.trim(),
      puCode: updatePollingUnitDto.puCode?.trim(),
    });

    if (!updated) {
      throw new NotFoundException(`Polling Unit with ID ${id} not found`);
    }
    return updated;
  }

  async remove(id: number): Promise<PollingUnit> {
    const pu = await this.findOne(id);
    const removed = await this.pollingUnitRepository.remove(id);
    if (!removed) {
      return pu;
    }
    return removed;
  }
}
