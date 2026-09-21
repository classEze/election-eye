import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
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
  @IsString()
  submissionCloseNotice?: string;

  @IsOptional()
  @IsDateString()
  votingStartTime?: string;

  @IsOptional()
  @IsDateString()
  votingEndTime?: string;
}
