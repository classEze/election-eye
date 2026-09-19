import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Lga } from './lga.entity';
import { CreateLgaDto, UpdateLgaDto, CreateLgaArrayDto } from './lga.dto';
import { LgaRepository } from './lga.repository';
import * as Papa from 'papaparse';
import { uploadDataRows } from './lga.data';
import { InjectQueue } from '@nestjs/bullmq';
import {
  APP_QUEUES,
  QueueDictionary,
} from '../../shared/constants/queue.constants';
import { Queue } from 'bullmq';
import { User } from '../user/user.entity';

@Injectable()
export class LgaService {
  constructor(
    private readonly lgaRepository: LgaRepository,
    @InjectQueue(APP_QUEUES.file) private fileQueue: Queue,
  ) {}

  generateTemplate(): string {
    return Papa.unparse(uploadDataRows);
  }

  async uploadLgas(file: Express.Multer.File, stateId: number, user: User) {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file uploaded');
    }

    this.validateCsvFile(file);

    await this.fileQueue.add(QueueDictionary.PROCESS_LGA_UPLOAD_WITH_STATE_ID, {
      csvData: file.buffer.toString('utf-8').trim(),
      stateId,
      userEmail: user.emailAddress,
    });

    return {
      message:
        'File uploaded successfully. You will receive an email once processing is complete.',
    };
  }

  async uploadLgasGeneric(file: Express.Multer.File, user: User) {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file uploaded');
    }

    this.validateCsvFile(file);

    await this.fileQueue.add(QueueDictionary.PROCESS_LGA_UPLOAD_GENERIC, {
      csvData: file.buffer.toString('utf-8').trim(),
      userEmail: user.emailAddress,
    });

    return {
      message:
        'File uploaded successfully. You will receive an email once processing is complete.',
    };
  }

  private validateCsvFile(file: Express.Multer.File) {
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

  async create(createLgaDto: CreateLgaDto): Promise<Lga> {
    const existing = await this.lgaRepository.findByNameAndState(
      createLgaDto.name.trim(),
      createLgaDto.stateId,
    );
    if (existing) {
      throw new BadRequestException(
        `LGA with name "${createLgaDto.name}" already exists in this state`,
      );
    }
    return this.lgaRepository.create({
      ...createLgaDto,
      name: createLgaDto.name.trim(),
    });
  }

  async createMultiple(createLgaArrayDto: CreateLgaArrayDto): Promise<Lga[]> {
    const lgasToInsert = createLgaArrayDto.lgas.map((lga) => ({
      ...lga,
      stateId: createLgaArrayDto.stateId,
    }));
    await this.lgaRepository.bulkInsert(lgasToInsert);
    return this.findByState(createLgaArrayDto.stateId);
  }

  async findAll(): Promise<Lga[]> {
    return this.lgaRepository.findAll();
  }

  async findByState(stateId: number): Promise<Lga[]> {
    return this.lgaRepository.findByState(stateId);
  }

  async findOne(id: number): Promise<Lga> {
    const lga = await this.lgaRepository.findOne(id);
    if (!lga) {
      throw new NotFoundException(`LGA with ID ${id} not found`);
    }
    return lga;
  }

  async update(id: number, updateLgaDto: UpdateLgaDto): Promise<Lga> {
    await this.findOne(id);
    const updated = await this.lgaRepository.update(id, {
      ...updateLgaDto,
      name: updateLgaDto.name?.trim(),
    });
    if (!updated) {
      throw new NotFoundException(`LGA with ID ${id} not found`);
    }
    return updated;
  }

  async remove(id: number): Promise<Lga> {
    const lga = await this.findOne(id);
    const removed = await this.lgaRepository.remove(id);
    if (!removed) {
      return lga;
    }
    return removed;
  }
}
