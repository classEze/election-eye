import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { LgaRepository } from '../features/lga/lga.repository';
import { WardRepository } from '../features/ward/ward.repository';
import { PollingUnitRepository } from '../features/polling-unit/polling-unit.repository';
import { StateService } from '../features/state/state.service';
import * as Papa from 'papaparse';
import {
  entityColumnNameCsvHeaderMap as lgaColumnMap,
  lgaDuplicateKey,
} from '../features/lga/lga.data';
import {
  entityColumnNameCsvHeaderMap as wardColumnMap,
  wardsDuplicateKey,
} from '../features/ward/ward.data';
import {
  entityColumnNameCsvHeaderMap as pollingUnitColumnMap,
  pollingUnitDuplicateKey,
} from '../features/polling-unit/polling-unit.data';
import { InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import {
  APP_QUEUES,
  QueueDictionary,
} from '@/shared/constants/queue.constants';

@Processor(APP_QUEUES.file)
export class FileConsumer extends WorkerHost {
  private readonly logger = new Logger(FileConsumer.name);

  constructor(
    private readonly lgaRepository: LgaRepository,
    private readonly wardRepository: WardRepository,
    private readonly pollingUnitRepository: PollingUnitRepository,
    private readonly stateService: StateService,
    @InjectQueue(APP_QUEUES.mail) private readonly mailQueue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case QueueDictionary.PROCESS_LGA_UPLOAD_WITH_STATE_ID:
        await this.processLgaUpload(
          job.data as { csvData: string; userEmail: string; stateId: number },
        );
        break;

      case QueueDictionary.PROCESS_LGA_UPLOAD_GENERIC:
        await this.processLgaUploadGeneric(
          job.data as { csvData: string; userEmail: string },
        );
        break;

      case QueueDictionary.PROCESS_WARD_UPLOAD_WITH_LGA_ID:
        await this.processWardUpload(
          job.data as { csvData: string; userEmail: string; lgaId: number },
        );
        break;

      case QueueDictionary.PROCESS_WARD_UPLOAD_GENERIC:
        await this.processWardUploadGeneric(
          job.data as { csvData: string; userEmail: string },
        );
        break;

      case QueueDictionary.PROCESS_POLLING_UNIT_UPLOAD_WITH_WARD_ID:
        await this.processPollingUnitUpload(
          job.data as { csvData: string; userEmail: string; wardId: number },
        );
        break;

      case QueueDictionary.PROCESS_POLLING_UNIT_UPLOAD_GENERIC:
        await this.processPollingUnitUploadGeneric(
          job.data as { csvData: string; userEmail: string },
        );
        break;

      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async processLgaUpload(data: {
    csvData: string;
    stateId: number;
    userEmail: string;
  }) {
    const { csvData, stateId, userEmail } = data;
    const startTime = new Date();
    let successCount = 0;
    let failedCount = 0;

    try {
      // Validate State ID using cached StateService
      await this.stateService.findOne(stateId);

      const parsed = Papa.parse<Record<string, string>>(csvData, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });

      if (
        parsed.errors.length > 0 &&
        parsed.errors[0].code !== 'UndetectableDelimiter'
      ) {
        throw new Error(`CSV Parsing Error: ${parsed.errors[0].message}`);
      }

      const rows = parsed.data;
      const expectedHeaders = Object.keys(lgaColumnMap);
      const actualHeaders =
        parsed.meta.fields?.map((h) => h.replace(/\s+/g, '').toLowerCase()) ||
        [];

      for (const expected of expectedHeaders) {
        if (
          !actualHeaders.includes(expected.replace(/\s+/g, '').toLowerCase())
        ) {
          throw new Error(
            `Invalid CSV headers. Missing expected header "${expected}".`,
          );
        }
      }

      const lgasToInsert: Record<string, string | number>[] = [];
      const seenKeys = new Set<string>();

      for (const row of rows) {
        const lgaData: Record<string, string | number> = { stateId };
        let rowValid = true;

        for (const headerName of expectedHeaders) {
          const matchingKey = Object.keys(row).find(
            (k) =>
              k.replace(/\s+/g, '').toLowerCase() ===
              headerName.replace(/\s+/g, '').toLowerCase(),
          );
          const rawVal = matchingKey ? row[matchingKey] : undefined;

          if (rawVal === undefined || rawVal === null || rawVal.trim() === '') {
            rowValid = false;
            break;
          }

          const dbPropertyName = lgaColumnMap[headerName] as string;
          lgaData[dbPropertyName] = rawVal.trim();
        }

        if (rowValid) {
          if (lgaDuplicateKey) {
            const rawKeyVal = String(lgaData[lgaDuplicateKey] ?? '').trim();
            const normalizedKeyVal = rawKeyVal.toLowerCase();
            if (rawKeyVal && !seenKeys.has(normalizedKeyVal)) {
              seenKeys.add(normalizedKeyVal);
              lgasToInsert.push(lgaData);
            } else {
              failedCount++;
            }
          } else {
            lgasToInsert.push(lgaData);
          }
        } else {
          failedCount++;
        }
      }

      if (lgasToInsert.length > 0) {
        await this.lgaRepository.bulkInsert(lgasToInsert);
        successCount = lgasToInsert.length;
      }
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing LGA upload: ${errMessage}`);
      failedCount = -1; // Indicate total failure
    }

    await this.sendUploadSummaryEmail(
      userEmail,
      'LGA',
      startTime,
      successCount,
      failedCount,
    );
  }

  private async processLgaUploadGeneric(data: {
    csvData: string;
    userEmail: string;
  }) {
    const { csvData, userEmail } = data;
    const startTime = new Date();
    let successCount = 0;
    let failedCount = 0;

    try {
      const states = await this.stateService.findAll(); // Cached
      const stateIdMap = new Map<number, boolean>();
      states.forEach((s) => stateIdMap.set(s.id, true));

      const parsed = Papa.parse<Record<string, string>>(csvData, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });

      if (
        parsed.errors.length > 0 &&
        parsed.errors[0].code !== 'UndetectableDelimiter'
      ) {
        throw new Error(`CSV Parsing Error: ${parsed.errors[0].message}`);
      }

      const rows = parsed.data;
      const expectedHeaders = Object.keys(lgaColumnMap);
      const actualHeaders =
        parsed.meta.fields?.map((h) => h.replace(/\s+/g, '').toLowerCase()) ||
        [];

      // Check for generic header
      if (!actualHeaders.includes('stateid')) {
        throw new Error(
          `Invalid CSV headers. Missing expected header "State Id".`,
        );
      }

      for (const expected of expectedHeaders) {
        if (
          !actualHeaders.includes(expected.replace(/\s+/g, '').toLowerCase())
        ) {
          throw new Error(
            `Invalid CSV headers. Missing expected header "${expected}".`,
          );
        }
      }

      const lgasToInsert: Record<string, string | number>[] = [];
      const seenKeys = new Set<string>();

      for (const row of rows) {
        let rowValid = true;

        const stateIdKey = Object.keys(row).find(
          (k) => k.replace(/\s+/g, '').toLowerCase() === 'stateid',
        );
        const stateIdRaw = stateIdKey ? row[stateIdKey] : undefined;

        if (
          !stateIdRaw ||
          isNaN(Number(stateIdRaw)) ||
          !stateIdMap.has(Number(stateIdRaw))
        ) {
          failedCount++;
          continue; // Skip row if State ID is invalid
        }

        const lgaData: Record<string, string | number> = {
          stateId: Number(stateIdRaw),
        };

        for (const headerName of expectedHeaders) {
          const matchingKey = Object.keys(row).find(
            (k) =>
              k.replace(/\s+/g, '').toLowerCase() ===
              headerName.replace(/\s+/g, '').toLowerCase(),
          );
          const rawVal = matchingKey ? row[matchingKey] : undefined;

          if (rawVal === undefined || rawVal === null || rawVal.trim() === '') {
            rowValid = false;
            break;
          }

          const dbPropertyName = lgaColumnMap[headerName] as string;
          lgaData[dbPropertyName] = rawVal.trim();
        }

        if (rowValid) {
          if (lgaDuplicateKey) {
            // Incorporate stateId to make duplicates check unique per state
            const rawKeyVal = String(lgaData[lgaDuplicateKey] ?? '').trim();
            const normalizedKeyVal = `${lgaData.stateId}-${rawKeyVal.toLowerCase()}`;
            if (rawKeyVal && !seenKeys.has(normalizedKeyVal)) {
              seenKeys.add(normalizedKeyVal);
              lgasToInsert.push(lgaData);
            } else {
              failedCount++;
            }
          } else {
            lgasToInsert.push(lgaData);
          }
        } else {
          failedCount++;
        }
      }

      if (lgasToInsert.length > 0) {
        await this.lgaRepository.bulkInsert(lgasToInsert);
        successCount = lgasToInsert.length;
      }
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing Generic LGA upload: ${errMessage}`);
      failedCount = -1;
    }

    await this.sendUploadSummaryEmail(
      userEmail,
      'LGA',
      startTime,
      successCount,
      failedCount,
    );
  }

  private async processWardUpload(data: {
    csvData: string;
    lgaId: number;
    userEmail: string;
  }) {
    const { csvData, lgaId, userEmail } = data;
    const startTime = new Date();
    let successCount = 0;
    let failedCount = 0;

    try {
      // Validate LGA exists in database without Redis caching
      const lga = await this.lgaRepository.findOne(lgaId);
      if (!lga) {
        throw new Error(`LGA with ID ${lgaId} does not exist.`);
      }

      const parsed = Papa.parse<Record<string, string>>(csvData, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });

      if (
        parsed.errors.length > 0 &&
        parsed.errors[0].code !== 'UndetectableDelimiter'
      ) {
        throw new Error(`CSV Parsing Error: ${parsed.errors[0].message}`);
      }

      const rows = parsed.data;
      const expectedHeaders = Object.keys(wardColumnMap);
      const actualHeaders =
        parsed.meta.fields?.map((h) => h.replace(/\s+/g, '').toLowerCase()) ||
        [];

      for (const expected of expectedHeaders) {
        if (
          !actualHeaders.includes(expected.replace(/\s+/g, '').toLowerCase())
        ) {
          throw new Error(
            `Invalid CSV headers. Missing expected header "${expected}".`,
          );
        }
      }

      const wardsToInsert: Record<string, string | number>[] = [];
      const seenNames = new Set<string>();
      const seenCodes = new Set<string>();

      for (const row of rows) {
        const wardData: Record<string, string | number> = { lgaId };
        let rowValid = true;

        for (const headerName of expectedHeaders) {
          const matchingKey = Object.keys(row).find(
            (k) =>
              k.replace(/\s+/g, '').toLowerCase() ===
              headerName.replace(/\s+/g, '').toLowerCase(),
          );
          const rawVal = matchingKey ? row[matchingKey] : undefined;

          if (rawVal === undefined || rawVal === null || rawVal.trim() === '') {
            rowValid = false;
            break;
          }

          const dbPropertyName = wardColumnMap[
            headerName as keyof typeof wardColumnMap
          ] as string;
          wardData[dbPropertyName] = rawVal.trim();
        }

        if (rowValid) {
          const rawName = String(wardData[wardsDuplicateKey] ?? '')
            .trim()
            .toLowerCase();
          const rawCode = String(wardData.wardCode ?? '').trim().toLowerCase();

          if (
            rawName &&
            rawCode &&
            !seenNames.has(rawName) &&
            !seenCodes.has(rawCode)
          ) {
            seenNames.add(rawName);
            seenCodes.add(rawCode);
            wardsToInsert.push(wardData);
          } else {
            failedCount++;
          }
        } else {
          failedCount++;
        }
      }

      if (wardsToInsert.length > 0) {
        await this.wardRepository.bulkInsert(wardsToInsert);
        successCount = wardsToInsert.length;
      }
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing Ward upload: ${errMessage}`);
      failedCount = -1; // Indicate total failure
    }

    await this.sendUploadSummaryEmail(
      userEmail,
      'Ward',
      startTime,
      successCount,
      failedCount,
    );
  }

  private async processWardUploadGeneric(data: {
    csvData: string;
    userEmail: string;
  }) {
    const { csvData, userEmail } = data;
    const startTime = new Date();
    let successCount = 0;
    let failedCount = 0;

    try {
      // Validate LGAs by fetching all LGAs from the database
      const lgas = await this.lgaRepository.findAll();
      const lgaIdMap = new Map<number, boolean>();
      lgas.forEach((l) => lgaIdMap.set(l.id, true));

      const parsed = Papa.parse<Record<string, string>>(csvData, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });

      if (
        parsed.errors.length > 0 &&
        parsed.errors[0].code !== 'UndetectableDelimiter'
      ) {
        throw new Error(`CSV Parsing Error: ${parsed.errors[0].message}`);
      }

      const rows = parsed.data;
      const expectedHeaders = Object.keys(wardColumnMap);
      const actualHeaders =
        parsed.meta.fields?.map((h) => h.replace(/\s+/g, '').toLowerCase()) ||
        [];

      // Check for generic LGA header (supports 'Lga Id', 'lgaId', 'lga_id')
      if (!actualHeaders.includes('lgaid')) {
        throw new Error(
          `Invalid CSV headers. Missing expected header "Lga Id".`,
        );
      }

      for (const expected of expectedHeaders) {
        if (
          !actualHeaders.includes(expected.replace(/\s+/g, '').toLowerCase())
        ) {
          throw new Error(
            `Invalid CSV headers. Missing expected header "${expected}".`,
          );
        }
      }

      const wardsToInsert: Record<string, string | number>[] = [];
      const seenNames = new Set<string>();
      const seenCodes = new Set<string>();

      for (const row of rows) {
        let rowValid = true;

        const lgaIdKey = Object.keys(row).find(
          (k) => k.replace(/\s+/g, '').toLowerCase() === 'lgaid',
        );
        const lgaIdRaw = lgaIdKey ? row[lgaIdKey] : undefined;

        if (
          !lgaIdRaw ||
          isNaN(Number(lgaIdRaw)) ||
          !lgaIdMap.has(Number(lgaIdRaw))
        ) {
          failedCount++;
          continue; // Skip row if LGA ID is invalid
        }

        const wardData: Record<string, string | number> = {
          lgaId: Number(lgaIdRaw),
        };

        for (const headerName of expectedHeaders) {
          const matchingKey = Object.keys(row).find(
            (k) =>
              k.replace(/\s+/g, '').toLowerCase() ===
              headerName.replace(/\s+/g, '').toLowerCase(),
          );
          const rawVal = matchingKey ? row[matchingKey] : undefined;

          if (rawVal === undefined || rawVal === null || rawVal.trim() === '') {
            rowValid = false;
            break;
          }

          const dbPropertyName = wardColumnMap[
            headerName as keyof typeof wardColumnMap
          ] as string;
          wardData[dbPropertyName] = rawVal.trim();
        }

        if (rowValid) {
          const rawNameKey = `${wardData.lgaId}-${String(wardData[wardsDuplicateKey] ?? '').trim().toLowerCase()}`;
          const rawCode = String(wardData.wardCode ?? '').trim().toLowerCase();

          if (
            rawCode &&
            !seenCodes.has(rawCode) &&
            !seenNames.has(rawNameKey)
          ) {
            seenNames.add(rawNameKey);
            seenCodes.add(rawCode);
            wardsToInsert.push(wardData);
          } else {
            failedCount++;
          }
        } else {
          failedCount++;
        }
      }

      if (wardsToInsert.length > 0) {
        await this.wardRepository.bulkInsert(wardsToInsert);
        successCount = wardsToInsert.length;
      }
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing Generic Ward upload: ${errMessage}`);
      failedCount = -1;
    }

    await this.sendUploadSummaryEmail(
      userEmail,
      'Ward',
      startTime,
      successCount,
      failedCount,
    );
  }

  private async processPollingUnitUpload(data: {
    csvData: string;
    wardId: number;
    userEmail: string;
  }) {
    const { csvData, wardId, userEmail } = data;
    const startTime = new Date();
    let successCount = 0;
    let failedCount = 0;

    try {
      // Validate Ward exists in database without Redis caching
      const ward = await this.wardRepository.findOne(wardId);
      if (!ward) {
        throw new Error(`Ward with ID ${wardId} does not exist.`);
      }

      const parsed = Papa.parse<Record<string, string>>(csvData, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });

      if (
        parsed.errors.length > 0 &&
        parsed.errors[0].code !== 'UndetectableDelimiter'
      ) {
        throw new Error(`CSV Parsing Error: ${parsed.errors[0].message}`);
      }

      const rows = parsed.data;
      const expectedHeaders = Object.keys(pollingUnitColumnMap);
      const actualHeaders =
        parsed.meta.fields?.map((h) => h.replace(/\s+/g, '').toLowerCase()) ||
        [];

      for (const expected of expectedHeaders) {
        if (
          !actualHeaders.includes(expected.replace(/\s+/g, '').toLowerCase())
        ) {
          throw new Error(
            `Invalid CSV headers. Missing expected header "${expected}".`,
          );
        }
      }

      const unitsToInsert: Record<string, string | number>[] = [];
      const seenNames = new Set<string>();
      const seenCodes = new Set<string>();

      for (const row of rows) {
        const puData: Record<string, string | number> = { wardId };
        let rowValid = true;

        for (const headerName of expectedHeaders) {
          const matchingKey = Object.keys(row).find(
            (k) =>
              k.replace(/\s+/g, '').toLowerCase() ===
              headerName.replace(/\s+/g, '').toLowerCase(),
          );
          const rawVal = matchingKey ? row[matchingKey] : undefined;

          if (rawVal === undefined || rawVal === null || rawVal.trim() === '') {
            rowValid = false;
            break;
          }

          const dbPropertyName = pollingUnitColumnMap[
            headerName as keyof typeof pollingUnitColumnMap
          ] as string;
          puData[dbPropertyName] = rawVal.trim();
        }

        if (rowValid) {
          const rawName = String(puData[pollingUnitDuplicateKey] ?? '')
            .trim()
            .toLowerCase();
          const rawCode = String(puData.puCode ?? '').trim().toLowerCase();

          if (
            rawName &&
            rawCode &&
            !seenNames.has(rawName) &&
            !seenCodes.has(rawCode)
          ) {
            seenNames.add(rawName);
            seenCodes.add(rawCode);
            unitsToInsert.push(puData);
          } else {
            failedCount++;
          }
        } else {
          failedCount++;
        }
      }

      if (unitsToInsert.length > 0) {
        await this.pollingUnitRepository.bulkInsert(unitsToInsert);
        successCount = unitsToInsert.length;
      }
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing Polling Unit upload: ${errMessage}`);
      failedCount = -1; // Indicate total failure
    }

    await this.sendUploadSummaryEmail(
      userEmail,
      'Polling Unit',
      startTime,
      successCount,
      failedCount,
    );
  }

  private async processPollingUnitUploadGeneric(data: {
    csvData: string;
    userEmail: string;
  }) {
    const { csvData, userEmail } = data;
    const startTime = new Date();
    let successCount = 0;
    let failedCount = 0;

    try {
      // Validate Wards by fetching all Wards from the database
      const wards = await this.wardRepository.findAll();
      const wardIdMap = new Map<number, boolean>();
      wards.forEach((w) => wardIdMap.set(w.id, true));

      const parsed = Papa.parse<Record<string, string>>(csvData, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });

      if (
        parsed.errors.length > 0 &&
        parsed.errors[0].code !== 'UndetectableDelimiter'
      ) {
        throw new Error(`CSV Parsing Error: ${parsed.errors[0].message}`);
      }

      const rows = parsed.data;
      const expectedHeaders = Object.keys(pollingUnitColumnMap);
      const actualHeaders =
        parsed.meta.fields?.map((h) => h.replace(/\s+/g, '').toLowerCase()) ||
        [];

      // Check for generic Ward header (supports 'Ward Id', 'wardId', 'ward_id')
      if (!actualHeaders.includes('wardid')) {
        throw new Error(
          `Invalid CSV headers. Missing expected header "Ward Id".`,
        );
      }

      for (const expected of expectedHeaders) {
        if (
          !actualHeaders.includes(expected.replace(/\s+/g, '').toLowerCase())
        ) {
          throw new Error(
            `Invalid CSV headers. Missing expected header "${expected}".`,
          );
        }
      }

      const unitsToInsert: Record<string, string | number>[] = [];
      const seenNames = new Set<string>();
      const seenCodes = new Set<string>();

      for (const row of rows) {
        let rowValid = true;

        const wardIdKey = Object.keys(row).find(
          (k) => k.replace(/\s+/g, '').toLowerCase() === 'wardid',
        );
        const wardIdRaw = wardIdKey ? row[wardIdKey] : undefined;

        if (
          !wardIdRaw ||
          isNaN(Number(wardIdRaw)) ||
          !wardIdMap.has(Number(wardIdRaw))
        ) {
          failedCount++;
          continue; // Skip row if Ward ID is invalid
        }

        const puData: Record<string, string | number> = {
          wardId: Number(wardIdRaw),
        };

        for (const headerName of expectedHeaders) {
          const matchingKey = Object.keys(row).find(
            (k) =>
              k.replace(/\s+/g, '').toLowerCase() ===
              headerName.replace(/\s+/g, '').toLowerCase(),
          );
          const rawVal = matchingKey ? row[matchingKey] : undefined;

          if (rawVal === undefined || rawVal === null || rawVal.trim() === '') {
            rowValid = false;
            break;
          }

          const dbPropertyName = pollingUnitColumnMap[
            headerName as keyof typeof pollingUnitColumnMap
          ] as string;
          puData[dbPropertyName] = rawVal.trim();
        }

        if (rowValid) {
          const rawNameKey = `${puData.wardId}-${String(puData[pollingUnitDuplicateKey] ?? '').trim().toLowerCase()}`;
          const rawCode = String(puData.puCode ?? '').trim().toLowerCase();

          if (
            rawCode &&
            !seenCodes.has(rawCode) &&
            !seenNames.has(rawNameKey)
          ) {
            seenNames.add(rawNameKey);
            seenCodes.add(rawCode);
            unitsToInsert.push(puData);
          } else {
            failedCount++;
          }
        } else {
          failedCount++;
        }
      }

      if (unitsToInsert.length > 0) {
        await this.pollingUnitRepository.bulkInsert(unitsToInsert);
        successCount = unitsToInsert.length;
      }
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error processing Generic Polling Unit upload: ${errMessage}`,
      );
      failedCount = -1;
    }

    await this.sendUploadSummaryEmail(
      userEmail,
      'Polling Unit',
      startTime,
      successCount,
      failedCount,
    );
  }

  private async sendUploadSummaryEmail(
    userEmail: string,
    entityName: string,
    uploadTime: Date,
    successCount: number,
    failedCount: number,
  ) {
    let summaryMessage = `Your ${entityName} upload initiated at ${uploadTime.toLocaleString()} has been processed. `;
    let summaryHtml = `<p>Your ${entityName} upload initiated at ${uploadTime.toLocaleString()} has been processed.</p>`;

    if (failedCount === -1) {
      summaryMessage += `The upload failed entirely due to invalid data format or missing requirements.`;
      summaryHtml += `<p>The upload failed entirely due to invalid data format or missing requirements.</p>`;
    } else {
      summaryMessage += `Successfully uploaded: ${successCount} records. Failed: ${failedCount} records.`;
      summaryHtml += `<ul><li><strong>Successfully uploaded:</strong> ${successCount} records</li><li><strong>Failed:</strong> ${failedCount} records</li></ul>`;
    }

    await this.mailQueue.add(QueueDictionary.SEND_MAIL, {
      to: userEmail,
      subject: `${entityName} Upload Processing Summary`,
      message: summaryMessage,
      html: summaryHtml,
    });
  }
}
