import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  Min,
  IsEnum,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ResultAuditStatus } from './result.entity';

export class PartyVoteDetailDto {
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  politicalPartyId!: number;

  @IsNotEmpty()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  votes!: number;
}

export class CreateResultDto {
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
  @Min(0)
  @Type(() => Number)
  totalRegisteredVoters?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  totalAccreditedVoters?: number;

  @IsNotEmpty()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  totalValidVotes!: number;

  @IsNotEmpty()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  rejectedVotes!: number;

  @IsOptional()
  @IsString()
  ec8aPhotoUrl?: string;

  @IsOptional()
  @IsDateString()
  clientSubmittedAt?: string;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartyVoteDetailDto)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  })
  partyBreakdown!: PartyVoteDetailDto[];
}

export class VerifyResultDto {
  @IsNotEmpty()
  @IsEnum(ResultAuditStatus)
  auditStatus!: ResultAuditStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class ResultFilterDto {
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
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isVerified?: boolean;

  @IsOptional()
  @IsEnum(ResultAuditStatus)
  auditStatus?: ResultAuditStatus;

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
