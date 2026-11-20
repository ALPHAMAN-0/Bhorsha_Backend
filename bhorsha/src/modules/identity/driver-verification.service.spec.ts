import { ConflictException, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../common/guards/auth-user.js';
import {
  DriverAvailability,
  type DriverProfile,
  DriverVerification,
} from '../fleet/entities/driver-profile.entity.js';
import { Role } from './entities/user.entity.js';
import { DriverVerificationService } from './driver-verification.service.js';

const NOW = new Date('2026-11-19T10:00:00Z');
const admin: AuthUser = { id: 1, role: Role.ADMIN, suspendedUntil: null };

function profile(overrides: Partial<DriverProfile> = {}): DriverProfile {
  return {
    userId: 12,
    licenceNo: 'DK-0123456789',
    verification: DriverVerification.PENDING,
    status: DriverAvailability.OFFLINE,
    rejectionReason: null,
    reviewedBy: null,
    reviewedAt: null,
    lastLat: null,
    lastLng: null,
    lastLocationAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    vehicles: [],
    user: {
      id: 12,
      fullName: 'Jamal Driver',
      phone: '+8801712345670',
      email: null,
      passwordHash: 'never-returned',
      role: Role.DRIVER,
      isActive: true,
      suspendedUntil: null,
      createdAt: NOW,
      updatedAt: NOW,
    },
    ...overrides,
  };
}

function setup() {
  const update = {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  const drivers = {
    findOneBy: vi.fn(),
    findOne: vi.fn(),
    findAndCount: vi.fn().mockResolvedValue([[profile()], 1]),
    createQueryBuilder: vi.fn(() => update),
  };
  const service = new DriverVerificationService(drivers as never);
  return { service, drivers, update };
}

describe('DriverVerificationService.list', () => {
  it('lists the pending queue oldest first, without the password hash', async () => {
    const { service, drivers } = setup();
    const result = await service.list({
      page: 1,
      limit: 10,
      verification: DriverVerification.PENDING,
    });
    expect(drivers.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { verification: DriverVerification.PENDING },
        order: { createdAt: 'ASC' },
      }),
    );
    expect(result.data[0].user).not.toHaveProperty('passwordHash');
    expect(result.data[0]).not.toHaveProperty('lastLat');
  });
});

describe('DriverVerificationService.verify', () => {
  it('answers 404 for an unknown driver', async () => {
    const { service, drivers } = setup();
    drivers.findOneBy.mockResolvedValue(null);
    await expect(
      service.verify(admin, 99, { verification: DriverVerification.VERIFIED }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a decision that is already in place', async () => {
    const { service, drivers } = setup();
    drivers.findOneBy.mockResolvedValue(
      profile({ verification: DriverVerification.VERIFIED }),
    );
    await expect(
      service.verify(admin, 12, { verification: DriverVerification.VERIFIED }),
    ).rejects.toThrow('Driver is already VERIFIED');
  });

  it('approves a driver and records who reviewed them', async () => {
    const { service, drivers, update } = setup();
    drivers.findOneBy.mockResolvedValue(profile());
    drivers.findOne.mockResolvedValue(
      profile({ verification: DriverVerification.VERIFIED, reviewedBy: 1 }),
    );

    const result = await service.verify(admin, 12, {
      verification: DriverVerification.VERIFIED,
    });

    const values = update.set.mock.calls[0][0];
    expect(values).toMatchObject({
      verification: DriverVerification.VERIFIED,
      rejectionReason: null,
      reviewedBy: 1,
    });
    expect(values).not.toHaveProperty('status');
    expect(update.where).toHaveBeenCalledWith(
      'user_id = :id AND verification = :current',
      { id: 12, current: DriverVerification.PENDING },
    );
    expect(result.verification).toBe(DriverVerification.VERIFIED);
  });

  it('rejects with a reason and takes the driver offline in the same update', async () => {
    const { service, drivers, update } = setup();
    drivers.findOneBy.mockResolvedValue(
      profile({
        verification: DriverVerification.VERIFIED,
        status: DriverAvailability.ONLINE,
      }),
    );
    drivers.findOne.mockResolvedValue(profile());

    await service.verify(admin, 12, {
      verification: DriverVerification.REJECTED,
      rejectionReason: 'Licence expired',
    });

    expect(update.set.mock.calls[0][0]).toMatchObject({
      verification: DriverVerification.REJECTED,
      rejectionReason: 'Licence expired',
      status: DriverAvailability.OFFLINE,
      reviewedBy: 1,
    });
  });

  it('answers 409 when another admin reviewed the driver first', async () => {
    const { service, drivers, update } = setup();
    drivers.findOneBy.mockResolvedValue(profile());
    update.execute.mockResolvedValue({ affected: 0 });
    await expect(
      service.verify(admin, 12, { verification: DriverVerification.VERIFIED }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
