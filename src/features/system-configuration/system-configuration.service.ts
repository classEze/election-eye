import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { SystemConfigurationRepository } from './system-configuration.repository';
import { SystemConfiguration } from './system-configuration.entity';
import { UpdateSystemConfigurationDto } from './system-configuration.dto';
import { Admin } from '../admin/admin.entity';

export const SYSTEM_CONFIG_CACHE_KEY = 'system:config:global';

@Injectable()
export class SystemConfigurationService {
  constructor(
    private readonly repository: SystemConfigurationRepository,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getConfiguration(): Promise<SystemConfiguration> {
    const cached = await this.cacheManager.get<SystemConfiguration>(
      SYSTEM_CONFIG_CACHE_KEY,
    );
    if (cached) {
      return cached;
    }

    const config = await this.repository.getConfiguration();
    await this.cacheManager.set(
      SYSTEM_CONFIG_CACHE_KEY,
      config,
      1000 * 60 * 120, // 120 minutes TTL
    );
    return config;
  }

  async updateConfiguration(
    dto: UpdateSystemConfigurationDto,
    admin?: Admin,
  ): Promise<SystemConfiguration> {
    const updated = await this.repository.updateConfiguration(dto, admin);
    // Invalidate & refresh Redis cache immediately
    await this.cacheManager.set(
      SYSTEM_CONFIG_CACHE_KEY,
      updated,
      1000 * 60 * 30,
    );
    return updated;
  }

  async isSubmissionAllowed(): Promise<{ allowed: boolean; reason?: string }> {
    const config = await this.getConfiguration();
    if (config.maintenanceMode) {
      return {
        allowed: false,
        reason: 'System is currently undergoing maintenance.',
      };
    }
    if (!config.isVotingActive || !config.allowAgentSubmissions) {
      return {
        allowed: false,
        reason:
          config.submissionCloseNotice ||
          'Submissions are currently closed by system administrators.',
      };
    }
    return { allowed: true };
  }

  async isIncidentReportingAllowed(): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    const config = await this.getConfiguration();
    if (config.maintenanceMode) {
      return {
        allowed: false,
        reason: 'System is currently undergoing maintenance.',
      };
    }
    if (!config.allowIncidentReporting) {
      return {
        allowed: false,
        reason:
          'Incident reporting is currently disabled by system administrators.',
      };
    }
    return { allowed: true };
  }
}
