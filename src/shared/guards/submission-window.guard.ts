import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { SystemConfigurationService } from '../../features/system-configuration/system-configuration.service';

@Injectable()
export class SubmissionWindowGuard implements CanActivate {
  constructor(
    private readonly systemConfigService: SystemConfigurationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const path = request.url || '';

    if (path.includes('incident')) {
      const status = await this.systemConfigService.isIncidentReportingAllowed();
      if (!status.allowed) {
        throw new ForbiddenException(status.reason);
      }
    } else {
      const status = await this.systemConfigService.isSubmissionAllowed();
      if (!status.allowed) {
        throw new ForbiddenException(status.reason);
      }
    }

    return true;
  }
}
