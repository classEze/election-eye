import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

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
