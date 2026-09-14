import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';

@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.getOrThrow<string>('mail.host'),
          port: configService.get<number>('mail.port', 2525),
          auth: {
            user: configService.getOrThrow<string>('mail.username'),
            pass: configService.getOrThrow<string>('mail.password'),
          },
        },
        defaults: {
          from: configService.getOrThrow<string>('mail.from'),
        },
      }),
    }),
  ],
})
export class MailerDefaultModule {}
