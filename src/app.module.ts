import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleModule } from './role/role.module';
import { ConfigModule } from '@nestjs/config';
import { AppDataSource } from './data-source';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { AuthenticationGuard } from './guards/authentication.guard';
import { APP_GUARD } from '@nestjs/core';
import { AuthorizationGuard } from './guards/authorization.guard';
import { NotificationModule } from './notification/notification.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { config } from 'dotenv';
import { HttpClientModule } from './default-modules/http.module';
import { JwtDefaultModule } from './default-modules/jwt.module';

config();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
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
  ],
})
export class AppModule {}
