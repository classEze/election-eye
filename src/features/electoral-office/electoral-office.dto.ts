import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  IsInt,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OfficeCategory } from './electoral-office.entity';
import { UserStatus } from 'src/shared/enums/status.enum';

export class CreateElectoralOfficeDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsEnum(OfficeCategory)
  @IsNotEmpty()
  category!: OfficeCategory;

  @IsNumber()
  @IsOptional()
  stateId?: number;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  lgaIds?: number[];

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  wardIds?: number[];
}

export class UpdateElectoralOfficeDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsEnum(OfficeCategory)
  @IsOptional()
  category?: OfficeCategory;

  @IsNumber()
  @IsOptional()
  stateId?: number;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  lgaIds?: number[];

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  wardIds?: number[];

  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;
}

export class OfficeCategoryFilterQueryDto {
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  limit: number = 20;
}

export class ElectoralOfficeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(OfficeCategory)
  category?: OfficeCategory;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  stateId?: number;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
