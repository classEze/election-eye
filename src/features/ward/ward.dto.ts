import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWardDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  wardCode!: string;

  @IsNumber()
  @IsNotEmpty()
  lgaId!: number;
}

export class UpdateWardDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  wardCode?: string;

  @IsNumber()
  @IsOptional()
  lgaId?: number;
}

export class CreateWardArrayDto {
  @IsNumber()
  @IsNotEmpty()
  lgaId!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWardItemDto)
  wards!: CreateWardItemDto[];
}

export class CreateWardItemDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  wardCode!: string;
}
