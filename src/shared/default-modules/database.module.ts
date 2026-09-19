import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { SeederService } from '@/seeds/seeder.service';

const isProd =
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('database.host'),
        port: config.get('database.port'),
        username: config.get('database.user'),
        password: config.get('database.password'),
        database: config.get('database.name'),
        autoLoadEntities: true,
        synchronize: !isProd,
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun: isProd,
        ssl: isProd ? { rejectUnauthorized: false } : false,
      }),
    }),
  ],
  providers: [SeederService],
  exports: [],
})
export class DefaultDatabaseModule {}
