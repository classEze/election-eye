/// <reference types="multer" />
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { State } from './state.entity';
import { CreateStateDto, UpdateStateDto, CreateStateArrayDto } from './state.dto';
import * as Papa from 'papaparse';
import { StateRepository } from './state.repository';
import {
  entityColumnNameCsvHeaderMap,
  statesDuplicateKey,
  uploadDataRows,
} from './state.data';

@Injectable()
export class StateService {
  constructor(
    private readonly stateRepository: StateRepository,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Generates a CSV template dynamically based on the State entity columns.
   */
  generateTemplate(): string {
    return Papa.unparse(uploadDataRows);
  }

  /**
   * Uploads and inserts multiple states from a CSV file.
   */
  async uploadStates(file: Express.Multer.File): Promise<State[]> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate CSV file type and extension
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

    const csvData = file.buffer.toString('utf-8').trim();
    if (!csvData) {
      throw new BadRequestException('Uploaded CSV file is empty');
    }

    const parsed = Papa.parse<Record<string, string>>(csvData, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    const fatalErrors = (parsed.errors || []).filter(
      (err) => err.code !== 'UndetectableDelimiter',
    );

    if (fatalErrors.length > 0) {
      throw new BadRequestException(
        `CSV Parsing Error: ${fatalErrors[0].message}`,
      );
    }

    const expectedHeaders = Object.keys(uploadDataRows[0]);
    const actualHeaders = parsed.meta.fields || [];

    const comparisonHeaderArr = actualHeaders.map((header) =>
      header.replace(/\s+/g, '').toLowerCase(),
    );

    // Validate that required headers are present in the CSV
    for (const expected of expectedHeaders) {
      const isPresent = comparisonHeaderArr.includes(
        expected.replace(/\s+/g, '').toLowerCase(),
      );
      if (!isPresent) {
        throw new BadRequestException(
          `Invalid CSV headers. Missing expected header "${expected}". Expected headers: ${expectedHeaders.join(', ')}`,
        );
      }
    }

    const rows = parsed.data;
    if (!rows || rows.length === 0) {
      throw new BadRequestException('CSV file has no data rows');
    }

    const statesToInsert: Record<string, string | number>[] = [];
    const seenNames = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const stateData: Record<string, string | number> = {};

      expectedHeaders.forEach((headerName) => {
        const matchingKey = Object.keys(row).find(
          (k) =>
            k.replace(/\s+/g, '').toLowerCase() ===
            headerName.replace(/\s+/g, '').toLowerCase(),
        );
        const rawVal = matchingKey ? row[matchingKey] : undefined;

        if (rawVal === undefined || rawVal === null || rawVal.trim() === '') {
          throw new BadRequestException(
            `Row ${i + 1} validation failed: Column "${headerName}" cannot be empty`,
          );
        }

        const trimmedVal = rawVal.trim();

        const dbPropertyName = entityColumnNameCsvHeaderMap[
          headerName
        ] as string;

        stateData[dbPropertyName] = trimmedVal;
      });

      if (statesDuplicateKey) {
        const rawKeyVal = String(stateData[statesDuplicateKey] ?? '').trim();
        const normalizedKeyVal = rawKeyVal.toLowerCase();
        if (rawKeyVal && !seenNames.has(normalizedKeyVal)) {
          seenNames.add(normalizedKeyVal);
          statesToInsert.push(stateData);
        }
      } else {
        statesToInsert.push(stateData);
      }
    }

    if (statesToInsert.length === 0) {
      throw new BadRequestException('CSV file contains no valid state entries');
    }

    await this.stateRepository.bulkInsert(statesToInsert);

    // Invalidate the cache
    await this.cacheManager.del('ALL_STATES');

    // Return all states in the database after successful creation
    return this.findAll();
  }

  async create(createStateArrayDto: CreateStateArrayDto): Promise<State[]> {
    const statesToInsert: Record<string, string | number>[] = [];
    const seenNames = new Set<string>();

    for (const dto of createStateArrayDto.states) {
      const existing = await this.stateRepository.findByName(dto.name.trim());
      if (existing) {
        throw new BadRequestException(
          `State with name "${dto.name}" already exists`,
        );
      }

      const normalizedName = dto.name.trim().toLowerCase();
      if (seenNames.has(normalizedName)) {
        throw new BadRequestException(
          `Duplicate state name "${dto.name}" found in the request`,
        );
      }
      seenNames.add(normalizedName);

      statesToInsert.push({
        name: dto.name.trim(),
        code: dto.code.trim(),
      });
    }

    if (statesToInsert.length > 0) {
      await this.stateRepository.bulkInsert(statesToInsert);
    }

    await this.cacheManager.del('ALL_STATES');
    return this.findAll();
  }

  async findAll(): Promise<State[]> {
    const cachedStates = await this.cacheManager.get<State[]>('ALL_STATES');
    if (cachedStates) {
      return cachedStates;
    }

    const states = await this.stateRepository.findAll();
    await this.cacheManager.set('ALL_STATES', states, 86400 * 1000); // 24 hours
    return states;
  }

  async findOne(id: number): Promise<State> {
    const state = await this.stateRepository.findOne(id);
    if (!state) {
      throw new NotFoundException(`State with ID ${id} not found`);
    }
    return state;
  }

  async update(id: number, updateStateDto: UpdateStateDto): Promise<State> {
    await this.findOne(id);
    const updated = await this.stateRepository.update(id, {
      ...updateStateDto,
      name: updateStateDto.name.trim(),
    });
    if (!updated) {
      throw new NotFoundException(`State with ID ${id} not found`);
    }
    await this.cacheManager.del('ALL_STATES');
    return updated;
  }

  async remove(id: number): Promise<State> {
    const state = await this.findOne(id);
    const removed = await this.stateRepository.remove(id);
    if (!removed) {
      return state;
    }
    await this.cacheManager.del('ALL_STATES');
    return removed;
  }
}
