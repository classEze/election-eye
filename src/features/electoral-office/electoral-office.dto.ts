import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  IsArray,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { OfficeCategory } from './electoral-office.entity';

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

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
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

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class OfficeCategoryFilterQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1 || value === '1') {
      return true;
    }
    if (value === 'false' || value === false || value === 0 || value === '0') {
      return false;
    }
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;
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
  @Min(10)
  @Max(200)
  limit: number = 20;
}
