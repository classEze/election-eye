import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  Max,
  IsEnum,
  IsDateString,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MaterialsArrivedStatus } from './materials-arrived.enum';

export class PreElectionReportMediaUploadUrlsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  @Type(() => Number)
  requestPhotoCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  @Type(() => Number)
  requestVideoCount?: number;

  @IsOptional()
  @IsString()
  photoContentType?: string;

  @IsOptional()
  @IsString()
  videoContentType?: string;
}

export class CreatePreElectionReportDto {
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  electoralOfficeId!: number;

  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  pollingUnitId!: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  aspirantId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  politicalPartyId?: number;

  @IsNotEmpty()
  @IsEnum(MaterialsArrivedStatus)
  materialsArrived!: MaterialsArrivedStatus;

  @IsOptional()
  @IsDateString()
  materialArrivalTime?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  totalRegisteredVoters?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  totalAccreditedVoters?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaPictureKeys?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaVideoKeys?: string[];

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @IsDateString()
  clientSubmittedAt?: string;
}

export class PreElectionReportFilterDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  electoralOfficeId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  pollingUnitId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  wardId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  lgaId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  stateId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  aspirantId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  politicalPartyId?: number;

  @IsOptional()
  @IsEnum(MaterialsArrivedStatus)
  @Type(() => Number)
  materialsArrived?: MaterialsArrivedStatus;

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

export interface PreElectionReportSummary {
  totalReports: number;
  materialsFullCount: number;
  materialsPartialCount: number;
  materialsNoneCount: number;
  totalRegisteredVoters: number;
  totalAccreditedVoters: number;
}

export interface PaginatedPreElectionReportsResponse {
  data: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: PreElectionReportSummary;
}
