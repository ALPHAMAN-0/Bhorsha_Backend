import {
  type CallHandler,
  type ExecutionContext,
  HttpStatus,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { map, type Observable } from 'rxjs';

export interface ApiResponse {
  success: true;
  message: string;
  data: unknown;
  meta: Record<string, unknown>;
}

interface Page {
  data: unknown;
  meta: Record<string, unknown>;
}

function isPage(body: unknown): body is Page {
  return (
    typeof body === 'object' &&
    body !== null &&
    'data' in body &&
    'meta' in body
  );
}

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse | undefined> {
    const response = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((body: unknown) => {
        if (response.statusCode === Number(HttpStatus.NO_CONTENT)) {
          return undefined;
        }
        const message =
          response.statusCode === Number(HttpStatus.CREATED) ? 'Created' : 'OK';
        if (isPage(body)) {
          return { success: true, message, data: body.data, meta: body.meta };
        }
        return { success: true, message, data: body ?? null, meta: {} };
      }),
    );
  }
}