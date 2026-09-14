import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleModule } from './features/role/role.module';
import { ConfigModule } from '@nestjs/config';
import { AppDataSource } from './data-source';
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
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...AppDataSource.options,
      }),
    }),
    RedisDefaultModule,
    MailerDefaultModule,
    JwtDefaultModule,
    HttpClientModule,
    RoleModule,
    UserModule,
    AuthModule,
    NotificationModule,
    AdminModule,
    AspirantModule,
    StateModule,
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
