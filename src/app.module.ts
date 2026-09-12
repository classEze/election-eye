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
import { MailerModule } from '@nestjs-modules/mailer';
import { config } from 'dotenv';
import { HttpClientModule } from './shared/default-modules/http.module';
import { JwtDefaultModule } from './shared/default-modules/jwt.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './features/auth/auth.module';
import { AdminModule } from './features/admin/admin.module';
import { AspirantModule } from './features/aspirant/aspirant.module';
import { AuthenticationGuard } from './shared/guards/authentication.guard';
import { AuthorizationGuard } from './shared/guards/authorization.guard';

const loadEnv = config as unknown as () => void;
loadEnv();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 20 }],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...AppDataSource.options,
      }),
    }),
    MailerModule.forRoot({
      transport: {
        host: 'sandbox.smtp.mailtrap.io',
        port: 2525,
        auth: {
          user: process.env.MAILTRAP_UNAME,
          pass: process.env.MAILTRAP_PASS,
        },
      },
      defaults: {
        from: '"No Reply" <noreply@innbase.com>',
      },
    }),
    JwtDefaultModule,
    HttpClientModule,
    RoleModule,
    UserModule,
    AuthModule,
    NotificationModule,
    AdminModule,
    AspirantModule,
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
