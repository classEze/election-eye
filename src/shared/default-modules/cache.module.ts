import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return {
          stores: [createKeyv(config.get<string>('redis.uri')) as any],
          ttl: 1000 * 60 * 10,
        };
      },
    }),
  ],
})
export class RedisDefaultModule {}
