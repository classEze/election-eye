import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Ward } from './ward.entity';
import { CreateWardDto, UpdateWardDto, CreateWardArrayDto } from './ward.dto';
import { WardRepository } from './ward.repository';
import * as Papa from 'papaparse';
import { uploadDataRows } from './ward.data';
import { InjectQueue } from '@nestjs/bullmq';
import {
  APP_QUEUES,
  QueueDictionary,
} from '../../shared/constants/queue.constants';
import { Queue } from 'bullmq';
import { User } from '../user/user.entity';
import { LgaService } from '../lga/lga.service';

@Injectable()
export class WardService {
  constructor(
    private readonly wardRepository: WardRepository,
    private readonly lgaService: LgaService,
    @InjectQueue(APP_QUEUES.file) private fileQueue: Queue,
  ) {}

  generateTemplate(): string {
    return Papa.unparse(uploadDataRows);
  }

  async uploadWards(
    file: Express.Multer.File,
    lgaId: number,
    user: User,
  ): Promise<{ message: string }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file uploaded');
    }

    if (!lgaId || isNaN(lgaId)) {
      throw new BadRequestException('A valid LGA ID must be provided');
    }

    // Validate LGA ID against the database
    await this.lgaService.findOne(lgaId);

    this.validateCsvFile(file);

    await this.fileQueue.add(QueueDictionary.PROCESS_WARD_UPLOAD_WITH_LGA_ID, {
      csvData: file.buffer.toString('utf-8').trim(),
      lgaId,
      userEmail: user.emailAddress,
    });

    return {
      message:
        'File uploaded successfully. You will receive an email once processing is complete.',
    };
  }

  async uploadWardsGeneric(
    file: Express.Multer.File,
    user: User,
  ): Promise<{ message: string }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file uploaded');
    }

    this.validateCsvFile(file);

    await this.fileQueue.add(QueueDictionary.PROCESS_WARD_UPLOAD_GENERIC, {
      csvData: file.buffer.toString('utf-8').trim(),
      userEmail: user.emailAddress,
    });

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

  async create(createWardDto: CreateWardDto): Promise<Ward> {
    await this.lgaService.findOne(createWardDto.lgaId);

    const existingName = await this.wardRepository.findByNameAndLga(
      createWardDto.name.trim(),
      createWardDto.lgaId,
    );
    if (existingName) {
      throw new BadRequestException(
        `Ward with name "${createWardDto.name}" already exists in this LGA`,
      );
    }

    const existingCode = await this.wardRepository.findByWardCode(
      createWardDto.wardCode.trim(),
    );
    if (existingCode) {
      throw new BadRequestException(
        `Ward with code "${createWardDto.wardCode}" already exists`,
      );
    }

    return this.wardRepository.create({
      ...createWardDto,
      name: createWardDto.name.trim(),
      wardCode: createWardDto.wardCode.trim(),
    });
  }

  async createMultiple(
    createWardArrayDto: CreateWardArrayDto,
  ): Promise<Ward[]> {
    await this.lgaService.findOne(createWardArrayDto.lgaId);

    const wardsToInsert = createWardArrayDto.wards.map((ward) => ({
      name: ward.name.trim(),
      wardCode: ward.wardCode.trim(),
      lgaId: createWardArrayDto.lgaId,
    }));

    await this.wardRepository.bulkInsert(wardsToInsert);
    return this.findByLga(createWardArrayDto.lgaId);
  }

  async findAll(): Promise<Ward[]> {
    return this.wardRepository.findAll();
  }

  async findByLga(lgaId: number): Promise<Ward[]> {
    await this.lgaService.findOne(lgaId);
    return this.wardRepository.findByLga(lgaId);
  }

  async findOne(id: number): Promise<Ward> {
    const ward = await this.wardRepository.findOne(id);
    if (!ward) {
      throw new NotFoundException(`Ward with ID ${id} not found`);
    }
    return ward;
  }

  async update(id: number, updateWardDto: UpdateWardDto): Promise<Ward> {
    await this.findOne(id);

    if (updateWardDto.lgaId !== undefined) {
      await this.lgaService.findOne(updateWardDto.lgaId);
    }

    const updated = await this.wardRepository.update(id, {
      ...updateWardDto,
      name: updateWardDto.name?.trim(),
      wardCode: updateWardDto.wardCode?.trim(),
    });

    if (!updated) {
      throw new NotFoundException(`Ward with ID ${id} not found`);
    }
    return updated;
  }

  async remove(id: number): Promise<Ward> {
    const ward = await this.findOne(id);
    const removed = await this.wardRepository.remove(id);
    if (!removed) {
      return ward;
    }
    return removed;
  }
}
