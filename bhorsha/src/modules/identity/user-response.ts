import type { DriverProfile } from '../fleet/entities/driver-profile.entity.js';
import type { Role, User } from './entities/user.entity.js';

/** What the API returns for a user. password_hash is never part of it. */
export interface PublicUser {
  id: number;
  fullName: string;
  phone: string;
  email: string | null;
  role: Role;
  isActive: boolean;
  suspendedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicDriverProfile {
  licenceNo: string;
  verification: DriverProfile['verification'];
  status: DriverProfile['status'];
}

/** Copies only the listed fields, so nothing secret can slip through. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    suspendedUntil: user.suspendedUntil,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function toPublicDriverProfile(profile: DriverProfile): PublicDriverProfile {
  return {
    licenceNo: profile.licenceNo,
    verification: profile.verification,
    status: profile.status,
  };
}
