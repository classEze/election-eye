import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { Response } from 'express';
import * as Papa from 'papaparse';
import {
  APP_QUEUES,
  QueueDictionary,
} from 'src/shared/constants/queue.constants';
import { AuditRepository } from './audit.repository';
import { AuditLogFilterDto, CreateAuditLogJobData } from './audit.dto';
import { AuditLog } from './audit.entity';
import { sanitizePayload } from 'src/shared/helpers/sanitizer.helper';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly auditRepository: AuditRepository,
    @InjectQueue(APP_QUEUES.audit) private readonly auditQueue: Queue,
  ) {}

  /**
   * Dispatches an audit log job asynchronously to BullMQ after deep-sanitizing sensitive payloads.
   */
  async record(data: CreateAuditLogJobData): Promise<void> {
    try {
      const sanitizedData: CreateAuditLogJobData = {
        ...data,
        requestPayload: data.requestPayload
          ? sanitizePayload(data.requestPayload)
          : null,
        oldState: data.oldState ? sanitizePayload(data.oldState) : null,
        newState: data.newState ? sanitizePayload(data.newState) : null,
        diff: data.diff ? sanitizePayload(data.diff) : null,
        metadata: data.metadata ? sanitizePayload(data.metadata) : null,
      };

      await this.auditQueue.add(
        QueueDictionary.RECORD_AUDIT_LOG,
        sanitizedData,
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: { count: 500, age: 3600 },
          removeOnFail: { count: 1000, age: 86400 },
        },
      );
    } catch (err) {
      this.logger.error(
        `Failed to enqueue audit log [${data.action}]: ${(err as Error).message}`,
      );
      // Fail-safe direct database write fallback if queue is unavailable
      try {
        await this.auditRepository.create(data);
      } catch (dbErr) {
        this.logger.error(
          `Fallback direct audit log DB write failed: ${(dbErr as Error).message}`,
        );
      }
    }
  }

  async findAll(
    filters: AuditLogFilterDto,
  ): Promise<{ data: AuditLog[]; total: number; page: number; limit: number }> {
    return this.auditRepository.findWithFilters(filters);
  }

  async findOne(id: number): Promise<AuditLog> {
    const log = await this.auditRepository.findById(id);
    if (!log) {
      throw new NotFoundException(`Audit log #${id} not found`);
    }
    return log;
  }

  async exportCsv(filters: AuditLogFilterDto, res: Response): Promise<void> {
    const logs = await this.auditRepository.streamWithFilters(filters);

    const formattedRows = logs.map((log) => ({
      ID: log.id,
      Timestamp: log.createdAt ? log.createdAt.toISOString() : '',
      ActorType: log.actorType,
      ActorID: log.actorId ?? 'N/A',
      ActorEmail: log.actorEmail ?? 'N/A',
      RoleCode: log.roleCode ?? 'N/A',
      Action: log.action,
      EntityName: log.entityName ?? 'N/A',
      HTTPMethod: log.httpMethod ?? 'N/A',
      Endpoint: log.endpoint ?? 'N/A',
      Status: log.status,
      ClientIP: log.ipAddress ?? 'N/A',
      ErrorMessage: log.errorMessage ?? '',
    }));

    const csvContent = Papa.unparse(formattedRows);

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `election-eye-audit-logs-${dateStr}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  }
}
