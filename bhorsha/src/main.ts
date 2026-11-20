import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { showPublicRoutesAsPublic } from './common/decorators/public.decorator.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  configureApp(app);

  // Configure Swagger Documentation at /api/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Bhorsha (ভরসা) - Rider Domain API')
    .setDescription(
      'Fair Ride-Hailing & Ride-Sharing Platform for Dhaka\n\n' +
      '### How to Authenticate in Swagger:\n' +
      'Log in with **POST /auth/login**, press **Authorize** and paste the `accessToken`.\n\n' +
      'Development only (`ALLOW_X_USER_ID=true` in .env): without a token you can instead type a user id in the **`x-user-id`** box of an endpoint. ' +
      'Seed users: `3` and `4` are riders, `5` is driver Karim, `2` and `10` are Support Officers, `1` is the Admin. ' +
      'When you have authorized, the token wins and `x-user-id` is ignored.',
    )
    .addTag('Rider Domain', '13 Core Endpoints: Quotes, Booking, Join Requests, Ratings, and SOS')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    // Every endpoint needs the token except the @Public() ones (register, login).
    .addSecurityRequirements('bearer')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  showPublicRoutesAsPublic(document);
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
