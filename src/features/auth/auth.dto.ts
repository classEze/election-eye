import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export enum ClientType {
  WEB = 'web',
  MOBILE = 'mobile',
  DESKTOP = 'desktop',
  THIRD_PARTY = 'third-party',
}

export class LoginDto {
  @IsEmail()
  emailAddress!: string;

  @IsNotEmpty()
  @IsString()
  password!: string;

  @IsOptional()
  @IsEnum(ClientType)
  clientType?: ClientType;
}

export class RefreshTokenDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class EmailAddressDto {
  @IsEmail()
  emailAddress!: string;
}

export class ResetPasswordDto {
  @IsNotEmpty()
  @IsString()
  passwordResetToken!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  confirmPassword!: string;
}

export class VerifyEmailDto {
  @IsNotEmpty()
  @IsString()
  token!: string;
}

export class ResendVerificationDto {
  @IsNotEmpty()
  @IsEmail()
  email!: string;
}

export class ChangePasswordDto {
  @IsNotEmpty()
  @IsString()
  currentPassword!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  newPassword!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  confirmPassword!: string;
}
