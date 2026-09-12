import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        timeout: config.get<number>('HTTP_TIMEOUT', 10000),
      }),
    }),
  ],
  exports: [HttpModule],
})
export class HttpClientModule {}
