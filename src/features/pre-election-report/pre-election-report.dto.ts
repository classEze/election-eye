import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MaterialsArrivedStatus } from './materials-arrived.enum';

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
  @Min(1)
  @Type(() => Number)
  page: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit: number = 20;
}
