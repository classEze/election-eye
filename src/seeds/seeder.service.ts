// src/seeds/seeder.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { seeders } from './index.seeder';

@Injectable()
export class SeederService implements OnModuleInit {
  private readonly logger = new Logger(SeederService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    // Only run if DB is ready (after synchronize or migrationsRun)
    if (!this.dataSource.isInitialized) {
      this.logger.warn('DataSource not initialized, skipping seed');
      return;
    }

    // Optional: skip seeding in test env
    if (process.env.SKIP_SEED === 'true') return;

    this.logger.log(`Running ${seeders.length} seeders...`);

    for (const seeder of seeders) {
      try {
        this.logger.log(`-> ${seeder.name}`);
        await seeder.run(this.dataSource);
      } catch (err) {
        this.logger.error(`Seeder ${seeder.name} failed`, (err as Error).stack);
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }

    this.logger.log('All seeders completed');
  }
}
