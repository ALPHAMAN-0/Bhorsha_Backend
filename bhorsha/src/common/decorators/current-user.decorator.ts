import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest, AuthUser } from '../guards/auth-user.js';

/**
 * Injects the logged-in user set by the global JwtAuthGuard.
 * `@CurrentUser()` gives the whole user, `@CurrentUser('id')` one field.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }
    return field ? user[field] : user;
  },
);
