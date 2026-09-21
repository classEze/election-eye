import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfiguration } from './system-configuration.entity';
import { UpdateSystemConfigurationDto } from './system-configuration.dto';
import { Admin } from '../admin/admin.entity';

@Injectable()
export class SystemConfigurationRepository {
  constructor(
    @InjectRepository(SystemConfiguration)
    private readonly repository: Repository<SystemConfiguration>,
  ) {}

  async getConfiguration(): Promise<SystemConfiguration> {
    let config = await this.repository.findOne({
      where: { id: 1 },
      relations: { updatedByAdmin: true },
    });

    if (!config) {
      config = this.repository.create({
        id: 1,
        isVotingActive: true,
        allowAgentSubmissions: true,
        allowIncidentReporting: true,
        maintenanceMode: false,
      });
      config = await this.repository.save(config);
    }

    return config;
  }

  async updateConfiguration(
    dto: UpdateSystemConfigurationDto,
    admin?: Admin,
  ): Promise<SystemConfiguration> {
    const config = await this.getConfiguration();

    if (dto.isVotingActive !== undefined)
      config.isVotingActive = dto.isVotingActive;
    if (dto.allowAgentSubmissions !== undefined)
      config.allowAgentSubmissions = dto.allowAgentSubmissions;
    if (dto.allowIncidentReporting !== undefined)
      config.allowIncidentReporting = dto.allowIncidentReporting;
    if (dto.maintenanceMode !== undefined)
      config.maintenanceMode = dto.maintenanceMode;
    if (dto.submissionCloseNotice !== undefined)
      config.submissionCloseNotice = dto.submissionCloseNotice;
    if (dto.votingStartTime !== undefined) {
      config.votingStartTime = dto.votingStartTime
        ? new Date(dto.votingStartTime)
        : null;
    }
    if (dto.votingEndTime !== undefined) {
      config.votingEndTime = dto.votingEndTime
        ? new Date(dto.votingEndTime)
        : null;
    }
    if (admin) {
      config.updatedByAdmin = admin;
    }

    return this.repository.save(config);
  }
}
