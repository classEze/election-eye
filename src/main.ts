import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AllExceptionsFilter } from './exceptions-filter';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

async function bootstrap(port: string) {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new ConsoleLogger({
      json: true,
      timestamp: true,
    }),
  });

  // Trust first reverse proxy hop (Render, AWS ALB, Nginx, Cloudflare)
  app.set('trust proxy', 1);

  // Security headers with Helmet (CSP, HSTS, clickjacking protection)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          scriptSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      frameguard: {
        action: 'deny',
      },
    }),
  );

  app.use(cookieParser());

  const { httpAdapter } = app.get<HttpAdapterHost>(HttpAdapterHost);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips properties not in DTO
      transform: true, // transforms payloads into DTO instances
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));
  await app.listen(port, '0.0.0.0');
}
bootstrap(process.env.PORT || '3000')
  .then(() => {
    console.log(`Server is running on port ${process.env.PORT ?? 5000}`);
  })
  .catch((error) => {
    console.error('Error starting server:', error);
    process.exit(1);
  });
