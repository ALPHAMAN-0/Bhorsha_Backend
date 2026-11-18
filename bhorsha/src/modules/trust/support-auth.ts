import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

// The identity team's verified JWT guard must populate request.user.
// Never trust x-user-id/x-role supplied directly by a browser.
export interface Principal { id: number; role: 'RIDER' | 'DRIVER' | 'ADMIN' | 'SUPPORT'; }
export type AuthRequest = Request & { user?: Partial<Principal> & { sub?: number }; requestId?: string };
export function principal(req: AuthRequest): Principal {
  const u = req.user;
  const id = Number(u?.id ?? u?.sub);
  if (!u || !Number.isSafeInteger(id) || id < 1 || !['RIDER','DRIVER','ADMIN','SUPPORT'].includes(u.role ?? '')) {
    throw new UnauthorizedException('Valid authenticated user required');
  }
  return { id, role: u.role as Principal['role'] };
}
export function officer(u: Principal): void {
  if (u.role !== 'SUPPORT' && u.role !== 'ADMIN') throw new ForbiddenException('Support/Admin only');
}
export function ownOrOfficer(u: Principal, id: number): void {
  if (u.id !== id) officer(u);
}
