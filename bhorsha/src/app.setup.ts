import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { validationExceptionFactory } from './common/filters/validation-exception.factory.js';
import { TimingInterceptor } from './common/interceptors/timing.interceptor.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';

/**
 * The /api/v1 prefix, request validation and the response envelope.
 * main.ts and the e2e tests both call it, so the tests see what clients see.
 */
export function configureApp(app: INestApplication): void {
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
}
