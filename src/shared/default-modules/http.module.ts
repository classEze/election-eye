import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        timeout: configService.getOrThrow<number>('http.timeout'),
      }),
    }),
  ],
  exports: [HttpModule],
})
export class HttpClientModule {}
