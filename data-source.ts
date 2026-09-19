import { config as loadEnv } from 'dotenv';

const configureEnv = loadEnv as unknown as () => void;
configureEnv();
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: 5432,
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [__dirname + 'src/**/*.entity{.ts,.js}'],
  migrations: [__dirname + 'src/migrations/*{.ts,.js}'],
  ssl: { rejectUnauthorized: false },
});
