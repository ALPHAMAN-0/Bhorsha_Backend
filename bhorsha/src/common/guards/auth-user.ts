import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { Repository } from 'typeorm';
import type { Role, User } from '../../modules/identity/entities/user.entity.js';

/** The logged-in user that the global JwtAuthGuard puts on request.user. */
export interface AuthUser {
  id: number;
  role: Role;
  suspendedUntil: Date | null;
}

export type AuthenticatedRequest = Request & {
  user?: AuthUser;
  requestId?: string;
};

/**
 * Reads the user from the database, so the role is always the current one and
 * a deactivated account stops working at once, even with a valid token.
 */
export async function loadAuthUser(
  users: Repository<User>,
  id: number,
): Promise<AuthUser> {
  const user = await users.findOne({
    where: { id },
    select: { id: true, role: true, isActive: true, suspendedUntil: true },
  });
  if (!user || !user.isActive) {
    throw new UnauthorizedException('Account not found or deactivated');
  }
  return { id: user.id, role: user.role, suspendedUntil: user.suspendedUntil };
}
