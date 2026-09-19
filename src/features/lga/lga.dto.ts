import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLgaDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  lgaCode!: string;

  @IsNumber()
  @IsNotEmpty()
  stateId!: number;
}

export class UpdateLgaDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  lgaCode?: string;

  @IsNumber()
  @IsOptional()
  stateId?: number;
}

export class CreateLgaArrayDto {
  @IsNumber()
  @IsNotEmpty()
  stateId!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLgaItemDto)
  lgas!: CreateLgaItemDto[];
}

export class CreateLgaItemDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  lgaCode!: string;
}
