import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsInt,
  Min,
} from 'class-validator';

export class UpdateSystemConfigurationDto {
  @IsOptional()
  @IsBoolean()
  isVotingActive?: boolean;

  @IsOptional()
  @IsBoolean()
  allowAgentSubmissions?: boolean;

  @IsOptional()
  @IsBoolean()
  allowIncidentReporting?: boolean;

  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional()
  @IsBoolean()
  enableOtp?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  otpValidity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  passwordMinimumLength?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maximumLoginAttempts?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maximumUploadSize?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maximumFilesPerSubmission?: number | null;

  @IsOptional()
  @IsString()
  allowedImageFormat?: string | null;

  @IsOptional()
  @IsBoolean()
  requireResultSheet?: boolean | null;

  @IsOptional()
  @IsBoolean()
  requireIncidentEvidence?: boolean | null;

  @IsOptional()
  @IsString()
  mandatoryResultFields?: string | null;

  @IsOptional()
  @IsBoolean()
  mandatoryIncidentFields?: boolean | null;

  @IsOptional()
  @IsString()
  submissionCloseNotice?: string;

  @IsOptional()
  @IsDateString()
  votingStartTime?: string;

  @IsOptional()
  @IsDateString()
  votingEndTime?: string;
}
