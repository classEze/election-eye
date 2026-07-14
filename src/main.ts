import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
// import { DataSource } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 5000);
  // await app.get(DataSource).runMigrations(); // If migrations dont run automatically, uncomment this line to run them manually
}
bootstrap();
