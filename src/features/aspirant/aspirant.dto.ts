import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

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
  politicalPartyId!: number;

  @IsNumber()
  electoralOfficeId!: number;

  @IsNumber()
  createdByAdminId!: number;

  @IsOptional()
  @IsString()
  logoUrl?: string;
}
