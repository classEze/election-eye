import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemConfiguration } from './system-configuration.entity';
import { SystemConfigurationRepository } from './system-configuration.repository';
import { SystemConfigurationService } from './system-configuration.service';
import { SystemConfigurationController } from './system-configuration.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SystemConfiguration])],
  controllers: [SystemConfigurationController],
  providers: [SystemConfigurationRepository, SystemConfigurationService],
  exports: [SystemConfigurationService, SystemConfigurationRepository],
})
export class SystemConfigurationModule {}
