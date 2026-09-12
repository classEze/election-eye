import { PartialType } from '@nestjs/mapped-types';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Role } from 'src/features/role/role.entity';

export class CreateUserDto {
  @IsOptional()
  id!: string;

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
  password!: string;

  @IsNumber()
  @IsNotEmpty()
  role!: Role;

  @IsOptional()
  isActive!: boolean;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}
