import {
  type ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '../../modules/identity/entities/user.entity.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthUser } from './auth-user.js';
import { RolesGuard } from './roles.guard.js';

function check(metadata: { isPublic?: boolean; roles?: Role[] }, user?: AuthUser) {
  const reflector = {
    getAllAndOverride: vi.fn((key: string) =>
      key === IS_PUBLIC_KEY ? metadata.isPublic : key === ROLES_KEY ? metadata.roles : undefined,
    ),
  };
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return new RolesGuard(reflector as never).canActivate(context);
}

const rider: AuthUser = { id: 3, role: Role.RIDER, suspendedUntil: null };
const admin: AuthUser = { id: 1, role: Role.ADMIN, suspendedUntil: null };

describe('RolesGuard', () => {
  it('lets any logged-in user through a route without @Roles()', () => {
    expect(check({}, rider)).toBe(true);
  });

  it('lets a matching role through', () => {
    expect(check({ roles: [Role.ADMIN] }, admin)).toBe(true);
  });

  it('refuses a role that is not listed with 403', () => {
    expect(() => check({ roles: [Role.ADMIN] }, rider)).toThrow(ForbiddenException);
  });

  it('gives an admin no implicit pass to other roles', () => {
    expect(() => check({ roles: [Role.SUPPORT] }, admin)).toThrow(ForbiddenException);
  });

  it('asks for a login when a role is required and nobody is logged in', () => {
    expect(() => check({ roles: [Role.ADMIN] })).toThrow(UnauthorizedException);
  });

  it('lets @Public() routes through', () => {
    expect(check({ isPublic: true, roles: [Role.ADMIN] })).toBe(true);
  });
});
