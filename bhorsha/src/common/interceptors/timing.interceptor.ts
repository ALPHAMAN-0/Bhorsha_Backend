import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { type Observable, tap } from 'rxjs';

@Injectable()
export class TimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Timing');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const start = performance.now();

    const record = (): void => {
      const ms = Math.round(performance.now() - start);
      if (!response.headersSent) {
        response.setHeader('X-Response-Time', `${ms}ms`);
      }
      this.logger.log(`${request.method} ${request.originalUrl} ${ms}ms`);
    };

    return next.handle().pipe(tap({ next: record, error: record }));
  }
}