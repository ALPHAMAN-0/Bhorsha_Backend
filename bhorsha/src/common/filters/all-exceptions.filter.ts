import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { QueryFailedError } from 'typeorm';
import type { AuthenticatedRequest } from '../guards/auth-user.js';
import { mapDatabaseError, type PgError } from './database-error.map.js';

export interface ErrorResponse {
  success: false;
  error: { code: string; message: string; details: unknown };
  meta: { requestId: string };
}

interface Described {
  status: number;
  code: string;
  message: string;
  details: unknown;
}

const INTERNAL: Described = {
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  code: 'INTERNAL_SERVER_ERROR',
  message: 'Internal server error',
  details: null,
};

/**
 * The one global exception filter. Every error leaves the API in the same
 * shape: { success: false, error: { code, message, details }, meta: { requestId } }.
 * Database rule violations become 409 (see database-error.map.ts). Anything
 * unexpected becomes a generic 500; the stack trace goes to the log only.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<Response>();
    const requestId = request.requestId ?? randomUUID();
    const described = this.describe(exception);

    const where = `${request.method} ${request.originalUrl} requestId=${requestId}`;
    if (described.status >= 500) {
      this.logger.error(
        `${where} -> ${described.status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (exception instanceof QueryFailedError) {
      const pg = exception.driverError as PgError;
      this.logger.warn(
        `${where} -> ${described.status} (${pg.code} ${pg.constraint ?? ''})`,
      );
    }

    if (response.headersSent) {
      return;
    }
    const body: ErrorResponse = {
      success: false,
      error: {
        code: described.code,
        message: described.message,
        details: described.details,
      },
      meta: { requestId },
    };
    response.status(described.status).json(body);
  }

  private describe(exception: unknown): Described {
    if (exception instanceof HttpException) {
      return this.describeHttp(exception);
    }
    if (exception instanceof QueryFailedError) {
      const mapped = mapDatabaseError(exception.driverError as PgError);
      return mapped ? { ...mapped, details: null } : INTERNAL;
    }
    return INTERNAL;
  }

  private describeHttp(exception: HttpException): Described {
    const status = exception.getStatus();
    const statusName = HttpStatus[status] ?? 'ERROR';
    const body = exception.getResponse();
    if (typeof body === 'string') {
      return { status, code: statusName, message: body, details: null };
    }
    const fields = body as {
      code?: unknown;
      message?: unknown;
      details?: unknown;
    };
    // The default ValidationPipe puts a list of messages in "message".
    const messageList = Array.isArray(fields.message);
    return {
      status,
      code:
        typeof fields.code === 'string'
          ? fields.code
          : messageList
            ? 'VALIDATION_FAILED'
            : statusName,
      message: messageList
        ? 'Validation failed'
        : typeof fields.message === 'string'
          ? fields.message
          : exception.message,
      details: fields.details ?? (messageList ? fields.message : null),
    };
  }
}
