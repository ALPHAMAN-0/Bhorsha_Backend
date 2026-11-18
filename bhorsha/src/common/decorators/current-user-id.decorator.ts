import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../guards/auth-user.js';

/**
 * The id of the logged-in user. The global JwtAuthGuard sets it from the
 * Bearer token, or from the x-user-id header while ALLOW_X_USER_ID=true in
 * development. The header itself is no longer trusted here.
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const userId = ctx.switchToHttp().getRequest<AuthenticatedRequest>().user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return userId;
  },
);
