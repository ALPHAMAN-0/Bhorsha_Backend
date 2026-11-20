import {
  type ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../modules/identity/entities/user.entity.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import {
  type AuthenticatedRequest,
  type AuthUser,
  loadAuthUser,
} from './auth-user.js';

/**
 * Global guard: every route needs a valid Bearer token unless it is @Public().
 *
 * Development fallback: while ALLOW_X_USER_ID=true (and NODE_ENV is not
 * production), a request without an Authorization header may name its user in
 * the x-user-id header instead. The user is still loaded from the database, so
 * the role is the real one and deactivated accounts are refused. Remove the
 * flag before the demo; a token always wins when both are sent.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private readonly allowUserIdHeader: boolean;

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    super();
    this.allowUserIdHeader =
      config.get<string>('ALLOW_X_USER_ID') === 'true' &&
      config.get<string>('NODE_ENV') !== 'production';
    if (this.allowUserIdHeader) {
      this.logger.warn(
        'ALLOW_X_USER_ID is on: requests without a token may use the x-user-id header (development only)',
      );
    }
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userIdHeader = request.headers['x-user-id'];
    if (
      this.allowUserIdHeader &&
      !request.headers.authorization &&
      userIdHeader !== undefined
    ) {
      const id = Number(userIdHeader);
      if (!Number.isSafeInteger(id) || id < 1) {
        throw new UnauthorizedException('x-user-id must be a positive integer');
      }
      request.user = await loadAuthUser(this.users, id);
      return true;
    }

    return (await super.canActivate(context)) as boolean;
  }

  override handleRequest<TUser = AuthUser>(
    error: unknown,
    user: TUser | false,
    info: unknown,
  ): TUser {
    if (error) {
      throw error;
    }
    if (!user) {
      const expired = info instanceof Error && info.name === 'TokenExpiredError';
      throw new UnauthorizedException(
        expired ? 'Access token expired' : 'Missing or invalid access token',
      );
    }
    return user;
  }
}
