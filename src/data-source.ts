import { config as loadEnv } from 'dotenv';

const configureEnv = loadEnv as unknown as () => void;
configureEnv();
import { DataSource } from 'typeorm';

const synchronize = ['development', 'dev', 'test', 'staging', 'uat'].includes(
  process.env.NODE_ENV?.toLowerCase() as string,
);

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: 5432,
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize,
  migrationsRun: true,
});
