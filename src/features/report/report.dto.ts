import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Result } from '../result/result.entity';
import { Incident } from '../incident/incident.entity';

export interface AspirantSummaryDto {
  total: number;
  active: number;
  inactive: number;
}

export interface AdminSummaryDto {
  total: number;
  systemAdmins: number;
  superAdmins: number;
}

export interface SystemActorsSummaryDto {
  totalStates: number;
  totalLgas: number;
  totalWards: number;
  totalPollingUnits: number;
  aspirants: AspirantSummaryDto;
  totalLgaCoordinators: number;
  totalWardCoordinators: number;
  totalPollingUnitAgents: number;
  totalPoliticalParties: number;
  totalElectoralOffices: number;
  admins: AdminSummaryDto;
}

export class SubmissionsAndIncidentsFilterDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  electoralOfficeId?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

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

export enum ActivityType {
  ALL = 'ALL',
  RESULT = 'RESULT',
  INCIDENT = 'INCIDENT',
}

export class MySubmissionsFilterDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  electoralOfficeId?: number;

  @IsOptional()
  @IsString()
  status?: string; // Maps to auditStatus or resolutionStatus

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(ActivityType)
  activityType?: ActivityType = ActivityType.ALL;

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

export interface SubmissionsAndIncidentsResponseDto {
  submissions: {
    data: Result[];
    total: number;
    page: number;
    limit: number;
  };
  incidents: {
    data: Incident[];
    total: number;
    page: number;
    limit: number;
  };
}

export interface AllTimeIncidentSubmissionStatsDto {
  submissions: {
    total: number;
    peakDay: string | null;
    peakCount: number;
    averagePerDay: number;
  };
  incidents: {
    total: number;
    peakDay: string | null;
    peakCount: number;
    averagePerDay: number;
  };
}
