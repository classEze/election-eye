import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { UserStatus } from '../../shared/enums/status.enum';

export class CreatePoliticalPartyDto {
  @IsNotEmpty({ message: 'Party name is required.' })
  @IsString()
  name!: string;

  @IsNotEmpty({ message: 'Party acronym/code is required.' })
  @IsString()
  @MaxLength(10)
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  code!: string;

  @IsOptional()
  @IsString()
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, {
    message:
      'partyColorHex must be a valid hex color code (e.g. #00BFFF or #FFF)',
  })
  partyColorHex?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus = UserStatus.ACTIVE;
}

export class UpdatePoliticalPartyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Transform(({ value }: { value: boolean | string }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  code?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, {
    message:
      'partyColorHex must be a valid hex color code (e.g. #00BFFF or #FFF)',
  })
  partyColorHex?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class UpdatePartyLogoDto {
  @IsOptional()
  @IsString()
  logoUrl?: string;
}

export class PoliticalPartyQueryDto {
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
