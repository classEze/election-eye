import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuditActorType, AuditStatus } from './audit.entity';

export class AuditLogFilterDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  actorId?: number;

  @IsOptional()
  @IsEnum(AuditActorType)
  actorType?: AuditActorType;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  entityName?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsEnum(AuditStatus)
  status?: AuditStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit: number = 20;
}

export interface CreateAuditLogJobData {
  actorId?: number | null;
  actorType: AuditActorType;
  actorEmail?: string | null;
  roleCode?: string | null;
  action: string;
  entityName?: string | null;
  entityId?: string | null;
  httpMethod?: string | null;
  endpoint?: string | null;
  statusCode?: number | null;
  status: AuditStatus;
  errorMessage?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestPayload?: Record<string, unknown> | null;
  oldState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  diff?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}
