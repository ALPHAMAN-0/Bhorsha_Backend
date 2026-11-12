import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Configure Swagger Documentation at /api/docs (Architecture v3.1)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Bhorsha (ভরসা) - Rider Domain API')
    .setDescription(
      'Fair Ride-Hailing & Ride-Sharing Platform for Dhaka — Architecture v3.1\n\n' +
      '**Engineer:** Numman (Student ID: 23-54538-3) — Rider Domain Backend Engineer\n\n' +
      '### How to Authenticate in Swagger:\n' +
      'Simply type your User ID in the **`x-user-id`** input box of each endpoint (e.g. `1` for Rider, `2` for Passenger).',
    )
    .setVersion('3.1')
    .addTag('Rider Domain', '13 Core Endpoints: Quotes, Booking, Join Requests, Ratings, and SOS')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Bhorsha Rider API Docs',
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`🚀 Bhorsha API running at: http://localhost:${port}/api/v1`);
  logger.log(`📚 Interactive Swagger UI available at: http://localhost:${port}/api/docs`);
}
await bootstrap();
