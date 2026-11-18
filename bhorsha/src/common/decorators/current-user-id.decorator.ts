import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const userId = Number(request.header('x-user-id'));
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new UnauthorizedException(
        'Send your user id in the x-user-id header',
      );
    }
    return userId;
  },
);