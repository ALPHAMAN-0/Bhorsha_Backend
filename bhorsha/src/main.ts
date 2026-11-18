import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { validationExceptionFactory } from './common/filters/validation-exception.factory.js';
import { TimingInterceptor } from './common/interceptors/timing.interceptor.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalInterceptors(
    new TimingInterceptor(),
    new TransformInterceptor(),
  );

  // Configure Swagger Documentation at /api/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Bhorsha (ভরসা) - Rider Domain API')
    .setDescription(
      'Fair Ride-Hailing & Ride-Sharing Platform for Dhaka\n\n' +
      '### How to Authenticate in Swagger:\n' +
      'Log in with **POST /auth/login**, press **Authorize** and paste the `accessToken`.\n\n' +
      'Development only (`ALLOW_X_USER_ID=true` in .env): you can instead type your User ID in the **`x-user-id`** input box of each endpoint (e.g. `1` for Rider, `2` for Passenger).',
    )
    .addTag('Rider Domain', '13 Core Endpoints: Quotes, Booking, Join Requests, Ratings, and SOS')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    // Every endpoint needs the token except the @Public() ones (register, login).
    .addSecurityRequirements('bearer')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Bhorsha Rider API Docs',
    customCss: `
      .swagger-ui .info .title small,
      .swagger-ui .info .title .version-pragma {
        display: none !important;
      }
    `,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`🚀 Bhorsha API running at: http://localhost:${port}/api/v1`);
  logger.log(`📚 Interactive Swagger UI available at: http://localhost:${port}/api/docs`);
}
await bootstrap();
