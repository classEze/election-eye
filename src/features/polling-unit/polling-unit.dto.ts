import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePollingUnitDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  puCode!: string;

  @IsNumber()
  @IsOptional()
  registeredVoters?: number;

  @IsNumber()
  @IsNotEmpty()
  wardId!: number;
}

export class UpdatePollingUnitDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  puCode?: string;

  @IsNumber()
  @IsOptional()
  registeredVoters?: number;

  @IsNumber()
  @IsOptional()
  wardId?: number;
}

export class CreatePollingUnitArrayDto {
  @IsNumber()
  @IsNotEmpty()
  wardId!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePollingUnitItemDto)
  pollingUnits!: CreatePollingUnitItemDto[];
}

export class CreatePollingUnitItemDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  puCode!: string;

  @IsNumber()
  @IsOptional()
  registeredVoters?: number;
}
