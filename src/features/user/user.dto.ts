import { PartialType } from '@nestjs/mapped-types';
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

export class CreateUserDto {
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

  @IsOptional()
  @IsString()
  password?: string;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  role_id!: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  assignedLgaId?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  assignedWardId?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  assignedPuId?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  aspirantId?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  onboardedByUserId?: number;

  @IsOptional()
  @IsString()
  deviceImei?: string;

  @IsOptional()
  @IsString()
  fcmToken?: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class UserQueryDto {
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
  roleId?: number;

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
  puId?: number;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class AspirantUsersQueryDto {
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
  @Type(() => String)
  role?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  roleId?: number;

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
  puId?: number;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
