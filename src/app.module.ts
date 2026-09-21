import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RoleModule } from './features/role/role.module';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './features/user/user.module';
import { APP_GUARD } from '@nestjs/core';
import { NotificationModule } from './shared/notification/notification.module';
import { HttpClientModule } from './shared/default-modules/http.module';
import { JwtDefaultModule } from './shared/default-modules/jwt.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './features/auth/auth.module';
import { AdminModule } from './features/admin/admin.module';
import { AspirantModule } from './features/aspirant/aspirant.module';
import { AuthenticationGuard } from './shared/guards/authentication.guard';
import { AuthorizationGuard } from './shared/guards/authorization.guard';
import { StateModule } from './features/state/state.module';
import { MailerDefaultModule } from './shared/default-modules/mail.module';
import { envValidationSchema } from './config/env.validation';
import configuration from './config/configuration';
import { RedisDefaultModule } from './shared/default-modules/cache.module';
import { DefaultQueueModule } from './shared/default-modules/queue.module';
import { LgaModule } from './features/lga/lga.module';
import { WardModule } from './features/ward/ward.module';
import { PollingUnitModule } from './features/polling-unit/polling-unit.module';
import { ElectoralOfficeModule } from './features/electoral-office/electoral-office.module';
import { DefaultDatabaseModule } from './shared/default-modules/database.module';
import { ResultModule } from './features/result/result.module';
import { IncidentModule } from './features/incident/incident.module';
import { SystemConfigurationModule } from './features/system-configuration/system-configuration.module';
import { StorageModule } from './shared/storage/storage.module';
import { PoliticalPartyModule } from './features/political-party/political-party.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),

    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 20 }],
    }),
    DefaultDatabaseModule,
    RedisDefaultModule,
    DefaultQueueModule,
    MailerDefaultModule,
    JwtDefaultModule,
    HttpClientModule,
    StorageModule,
    RoleModule,
    UserModule,
    AuthModule,
    NotificationModule,
    AdminModule,
    AspirantModule,
    StateModule,
    LgaModule,
    WardModule,
    PollingUnitModule,
    ElectoralOfficeModule,
    ResultModule,
    IncidentModule,
    SystemConfigurationModule,
    PoliticalPartyModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthorizationGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
