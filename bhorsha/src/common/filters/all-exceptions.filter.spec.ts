import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Logger,
  NotFoundException,
  type ValidationError,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { AllExceptionsFilter } from './all-exceptions.filter.js';
import { mapDatabaseError } from './database-error.map.js';
import { validationExceptionFactory } from './validation-exception.factory.js';

function pgError(code: string, constraint?: string): QueryFailedError {
  const driverError = Object.assign(new Error('raw database message'), {
    code,
    constraint,
  });
  return new QueryFailedError('INSERT INTO users ...', [], driverError);
}

function run(exception: unknown, options: { requestId?: string; headersSent?: boolean } = {}) {
  const json = vi.fn();
  const response = {
    headersSent: options.headersSent ?? false,
    status: vi.fn((_code: number) => ({ json })),
  };
  const request = {
    method: 'POST',
    originalUrl: '/api/v1/auth/register',
    requestId: options.requestId,
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  };
  new AllExceptionsFilter().catch(exception, host as never);
  return {
    status: response.status.mock.calls[0]?.[0] as number | undefined,
    body: json.mock.calls[0]?.[0],
  };
}

beforeEach(() => {
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AllExceptionsFilter', () => {
  it('maps a duplicate phone to 409 with the friendly message', () => {
    const { status, body } = run(pgError('23505', 'uq_users_phone'), {
      requestId: 'req-1',
    });
    expect(status).toBe(409);
    expect(body).toEqual({
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'Phone number already registered',
        details: null,
      },
      meta: { requestId: 'req-1' },
    });
  });

  it('maps an unlisted check violation to a generic 409', () => {
    const { status, body } = run(pgError('23514', 'ck_something_new'));
    expect(status).toBe(409);
    expect(body.error.message).toBe('Request conflicts with the current data');
  });

  it('maps the appeal separation-of-duties rule to 403', () => {
    const { status, body } = run(
      pgError('23514', 'ck_appeals_separation_of_duties'),
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('maps a deadlock to 409 Busy', () => {
    const { status, body } = run(pgError('40P01'));
    expect(status).toBe(409);
    expect(body.error).toMatchObject({ code: 'BUSY', message: 'Busy, please retry' });
  });

  it('turns a bug-class database error into a 500 that leaks nothing', () => {
    const { status, body } = run(pgError('428C9'));
    expect(status).toBe(500);
    expect(body.error.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('raw database message');
    expect(JSON.stringify(body)).not.toContain('INSERT');
  });

  it('turns an unknown error into a 500 without the stack trace', () => {
    const { status, body } = run(new Error('secret detail'));
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('secret detail');
    expect(JSON.stringify(body)).not.toContain('at ');
  });

  it('passes a Nest HttpException through with its status and message', () => {
    const { status, body } = run(new NotFoundException('User not found'));
    expect(status).toBe(404);
    expect(body.error).toEqual({
      code: 'NOT_FOUND',
      message: 'User not found',
      details: null,
    });
  });

  it('keeps details given to an HttpException', () => {
    const details = [{ field: 'baseTk', max: 85 }];
    const { status, body } = run(
      new ConflictException({ message: 'Fare is above the legal ceiling', details }),
    );
    expect(status).toBe(409);
    expect(body.error.details).toEqual(details);
  });

  it('turns the default ValidationPipe message list into details', () => {
    const messages = ['phone must look like +8801712345678'];
    const { status, body } = run(new BadRequestException(messages));
    expect(status).toBe(400);
    expect(body.error).toEqual({
      code: 'VALIDATION_FAILED',
      message: 'Validation failed',
      details: messages,
    });
  });

  it('uses the request id from the request, or makes one', () => {
    const { body } = run(new NotFoundException());
    expect(body.meta.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('does not write when the response was already sent', () => {
    const { status } = run(new Error('late'), { headersSent: true });
    expect(status).toBeUndefined();
  });
});

describe('validationExceptionFactory', () => {
  it('lists every failing field, including nested ones', () => {
    const errors: ValidationError[] = [
      { property: 'phone', constraints: { matches: 'phone is invalid' }, children: [] },
      {
        property: 'address',
        children: [
          { property: 'city', constraints: { isString: 'city must be text' }, children: [] },
        ],
      },
    ];
    const { status, body } = run(validationExceptionFactory(errors));
    expect(status).toBe(HttpStatus.BAD_REQUEST);
    expect(body.error).toEqual({
      code: 'VALIDATION_FAILED',
      message: 'Validation failed',
      details: [
        { field: 'phone', messages: ['phone is invalid'] },
        { field: 'address.city', messages: ['city must be text'] },
      ],
    });
  });
});

describe('mapDatabaseError', () => {
  it('ignores errors that are not database rule violations', () => {
    expect(mapDatabaseError(undefined)).toBeNull();
    expect(mapDatabaseError({ code: '42P01' })).toBeNull();
  });
});
