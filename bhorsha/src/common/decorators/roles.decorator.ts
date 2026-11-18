import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../users/entities/user.entity.js';

export const ROLES_KEY = 'roles';

/**
 * Limits a route to the given roles. Checked by the global RolesGuard.
 * Routes without @Roles() are open to any logged-in user.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
