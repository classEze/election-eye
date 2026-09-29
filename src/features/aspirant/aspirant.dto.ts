import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserStatus } from 'src/shared/enums/status.enum';

export class CreateAspirantDto {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsEmail()
  emailAddress!: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;

  @IsNumber()
  @Type(() => Number)
  politicalPartyId!: number;

  @IsNumber()
  @Type(() => Number)
  electoralOfficeId!: number;
}

export class AspirantQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  partyId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  officeId?: number;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
