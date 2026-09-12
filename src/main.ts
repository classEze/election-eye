import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './exceptions-filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({
      json: true,
      timestamp: true,
    }),
  });

  const { httpAdapter } = app.get<HttpAdapterHost>(HttpAdapterHost);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips properties not in DTO
      transform: true, // transforms payloads into DTO instances
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));

  await app.listen(process.env.PORT ?? 5000);
}
bootstrap()
  .then(() => {
    console.log(`Server is running on port ${process.env.PORT ?? 5000}`);
  })
  .catch((error) => {
    console.error('Error starting server:', error);
    process.exit(1);
  });
