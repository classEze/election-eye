import {
  IsInt,
  IsNotEmpty,
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
import { ResultAuditStatus, MaterialsArrivedStatus } from './result.entity';

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
  politicalPartyId!: number;

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
  ec8aPhotoKey?: string;

  @IsOptional()
  @IsString()
  videoKey?: string;

  @IsOptional()
  @IsEnum(MaterialsArrivedStatus)
  materialsArrived?: MaterialsArrivedStatus;

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

export class SituationRoomFilterDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  stateId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  lgaId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  wardId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  pollingUnitId?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true || value === '1')
  includeUnverified?: boolean;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(ResultAuditStatus, {
    message: 'auditStatus must be one of: PENDING, VERIFIED, FLAGGED, REJECTED',
  })
  auditStatus?: ResultAuditStatus;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  politicalPartyId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  aspirantId?: number;
}

export class RecentSubmissionsFilterDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  stateId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  lgaId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  wardId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  pollingUnitId?: number;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(ResultAuditStatus, {
    message: 'auditStatus must be one of: PENDING, VERIFIED, FLAGGED, REJECTED',
  })
  auditStatus?: ResultAuditStatus;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(ResultAuditStatus, {
    message: 'status must be one of: PENDING, VERIFIED, FLAGGED, REJECTED',
  })
  status?: ResultAuditStatus | string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  politicalPartyId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  aspirantId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;
}

export class ResultMediaUploadUrlsDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  requestPhoto?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  requestVideo?: boolean;

  @IsOptional()
  @IsString()
  photoContentType?: string;

  @IsOptional()
  @IsString()
  videoContentType?: string;
}

