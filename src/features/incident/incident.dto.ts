import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  ArrayMaxSize,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { IncidentStatus, SeverityLevel } from './incident.entity';

export class CreateIncidentDto {
  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  categoryId!: number;

  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsOptional()
  @IsEnum(SeverityLevel)
  severityLevel?: SeverityLevel = SeverityLevel.MEDIUM;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  pollingUnitId?: number;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  geolocationLat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  geolocationLng?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2, { message: 'Maximum of 2 video evidences allowed.' })
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [value];
      }
    }
    return value;
  })
  mediaVideoUrls?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5, { message: 'Maximum of 5 picture evidences allowed.' })
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [value];
      }
    }
    return value;
  })
  mediaPictureUrls?: string[];
}

export class UpdateIncidentStatusDto {
  @IsNotEmpty()
  @IsEnum(IncidentStatus)
  status!: IncidentStatus;
}

export class IncidentFilterDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  categoryId?: number;

  @IsOptional()
  @IsEnum(SeverityLevel)
  severityLevel?: SeverityLevel;

  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

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

export class IncidentMapClusterQueryDto {
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  minLat!: number;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  maxLat!: number;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  minLng!: number;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  maxLng!: number;
}
