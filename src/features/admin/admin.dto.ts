import { IsEmail, IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateAdminDto {
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
  @IsNotEmpty()
  role_id!: number;
}

export class UpdateAdminDto extends PartialType(CreateAdminDto) {}
