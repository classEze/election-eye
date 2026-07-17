import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips properties not in DTO
      transform: true, // transforms payloads into DTO instances
    }),
  );
  // await app.get(DataSource).runMigrations();
  // // If migrations dont run automatically, uncomment this line to run them manually

  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();
