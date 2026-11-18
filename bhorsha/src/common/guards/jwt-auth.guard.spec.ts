import {
  type ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '../../users/entities/user.entity.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { AuthenticatedRequest } from './auth-user.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

interface Options {
  allowHeader?: string;
  nodeEnv?: string;
  isPublic?: boolean;
  headers?: Record<string, string>;
}

function setup(options: Options = {}) {
  const env: Record<string, string | undefined> = {
    ALLOW_X_USER_ID: options.allowHeader,
    NODE_ENV: options.nodeEnv ?? 'development',
  };
  const config = { get: vi.fn((key: string) => env[key]) };
  const reflector = {
    getAllAndOverride: vi.fn((key: string) =>
      key === IS_PUBLIC_KEY ? options.isPublic : undefined,
    ),
  };
  const users = { findOne: vi.fn() };
  const guard = new JwtAuthGuard(reflector as never, config as never, users as never);

  const request = { headers: options.headers ?? {} } as AuthenticatedRequest;
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { guard, users, request, context };
}

let jwtCanActivate: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  // The passport AuthGuard('jwt') parent: stands in for real token checking.
  jwtCanActivate = vi
    .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
    .mockResolvedValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('JwtAuthGuard', () => {
  it('lets @Public() routes through without any check', async () => {
    const { guard, context, users } = setup({ isPublic: true });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwtCanActivate).not.toHaveBeenCalled();
    expect(users.findOne).not.toHaveBeenCalled();
  });

  it('ignores x-user-id and asks for a token when the flag is off', async () => {
    const { guard, context, request } = setup({ headers: { 'x-user-id': '5' } });
    await guard.canActivate(context);
    expect(jwtCanActivate).toHaveBeenCalled();
    expect(request.user).toBeUndefined();
  });

  it('accepts x-user-id with the real role from the database when the flag is on', async () => {
    const { guard, context, request, users } = setup({
      allowHeader: 'true',
      headers: { 'x-user-id': '5' },
    });
    users.findOne.mockResolvedValue({
      id: 5,
      role: Role.DRIVER,
      isActive: true,
      suspendedUntil: null,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(users.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5 } }),
    );
    expect(request.user).toEqual({ id: 5, role: Role.DRIVER, suspendedUntil: null });
    expect(jwtCanActivate).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown user', null],
    ['a deactivated user', { id: 5, role: Role.RIDER, isActive: false, suspendedUntil: null }],
  ])('refuses x-user-id for %s', async (_name, stored) => {
    const { guard, context, users } = setup({
      allowHeader: 'true',
      headers: { 'x-user-id': '5' },
    });
    users.findOne.mockResolvedValue(stored);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refuses an x-user-id that is not a positive integer', async () => {
    const { guard, context, users } = setup({
      allowHeader: 'true',
      headers: { 'x-user-id': 'abc' },
    });
    await expect(guard.canActivate(context)).rejects.toThrow(
      'x-user-id must be a positive integer',
    );
    expect(users.findOne).not.toHaveBeenCalled();
  });

  it('prefers the Bearer token when both are sent', async () => {
    const { guard, context, users } = setup({
      allowHeader: 'true',
      headers: { 'x-user-id': '5', authorization: 'Bearer abc' },
    });
    await guard.canActivate(context);
    expect(jwtCanActivate).toHaveBeenCalled();
    expect(users.findOne).not.toHaveBeenCalled();
  });

  it('never allows the header fallback in production', async () => {
    const { guard, context, users } = setup({
      allowHeader: 'true',
      nodeEnv: 'production',
      headers: { 'x-user-id': '5' },
    });
    await guard.canActivate(context);
    expect(jwtCanActivate).toHaveBeenCalled();
    expect(users.findOne).not.toHaveBeenCalled();
  });

  describe('handleRequest', () => {
    const { guard } = setup();

    it('returns the user from a valid token', () => {
      const user = { id: 1, role: Role.ADMIN, suspendedUntil: null };
      expect(guard.handleRequest(null, user, undefined)).toBe(user);
    });

    it('says when the token has expired', () => {
      const expired = Object.assign(new Error('jwt expired'), {
        name: 'TokenExpiredError',
      });
      expect(() => guard.handleRequest(null, false, expired)).toThrow(
        'Access token expired',
      );
    });

    it('refuses a missing or broken token', () => {
      expect(() =>
        guard.handleRequest(null, false, new Error('No auth token')),
      ).toThrow('Missing or invalid access token');
    });

    it('passes through errors from the strategy', () => {
      const error = new UnauthorizedException('Account not found or deactivated');
      expect(() => guard.handleRequest(error, false, undefined)).toThrow(error);
    });
  });
});
