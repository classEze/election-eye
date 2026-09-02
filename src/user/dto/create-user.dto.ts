import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Role } from 'src/entities/role.entity';

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

  @IsOptional()
  password!: string;

  @IsNumber()
  @IsNotEmpty()
  role!: Role;

  @IsOptional()
  status!: boolean;
}
