import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../common/guards/auth-user.js';
import {
  DriverAvailability,
  DriverProfile,
} from '../../fleet/entities/driver-profile.entity.js';
import { Role, User } from '../../users/entities/user.entity.js';
import { UserStatusFilter } from './dto/list-users-query.dto.js';
import { UsersService } from './users.service.js';

const NOW = new Date('2026-11-19T10:00:00Z');

function stored(overrides: Partial<User> = {}): User {
  return {
    id: 20,
    fullName: 'Karim Mia',
    phone: '+8801812345678',
    email: null,
    passwordHash: 'never-returned',
    role: Role.RIDER,
    isActive: true,
    suspendedUntil: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const admin: AuthUser = { id: 1, role: Role.ADMIN, suspendedUntil: null };
const owner: AuthUser = { id: 20, role: Role.RIDER, suspendedUntil: null };

function setup() {
  const listQuery = {
    orderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn().mockResolvedValue([[stored()], 1]),
  };
  const users = {
    createQueryBuilder: vi.fn(() => listQuery),
    findOneBy: vi.fn(),
    existsBy: vi.fn(),
    insert: vi.fn().mockResolvedValue({ identifiers: [{ id: 30 }] }),
  };
  const manager = { update: vi.fn() };
  const dataSource = {
    transaction: vi.fn(async (work: (m: typeof manager) => Promise<void>) => work(manager)),
  };
  const passwords = { hash: vi.fn().mockResolvedValue('$2b$12$hash') };
  const service = new UsersService(
    users as never,
    dataSource as never,
    passwords as never,
  );
  return { service, users, manager, listQuery, passwords };
}

describe('UsersService.list', () => {
  it('pages the newest users first and never returns the hash', async () => {
    const { service, listQuery } = setup();
    const result = await service.list({ page: 2, limit: 5 });
    expect(listQuery.orderBy).toHaveBeenCalledWith('u.id', 'DESC');
    expect(listQuery.skip).toHaveBeenCalledWith(5);
    expect(listQuery.take).toHaveBeenCalledWith(5);
    expect(result.meta).toEqual({ page: 2, limit: 5, total: 1 });
    expect(result.data[0]).not.toHaveProperty('passwordHash');
  });

  it('filters by role and by suspended status', async () => {
    const { service, listQuery } = setup();
    await service.list({
      page: 1,
      limit: 10,
      role: Role.DRIVER,
      status: UserStatusFilter.SUSPENDED,
    });
    expect(listQuery.andWhere).toHaveBeenCalledWith('u.role = :role', {
      role: Role.DRIVER,
    });
    expect(listQuery.andWhere).toHaveBeenCalledWith('u.suspendedUntil > now()');
  });
});

describe('UsersService.createStaff', () => {
  it('hashes the password and returns the new account', async () => {
    const { service, users, passwords } = setup();
    users.findOneBy.mockResolvedValue(stored({ id: 30, role: Role.SUPPORT }));
    const result = await service.createStaff({
      fullName: 'Nadia Support',
      phone: '+8801912345678',
      password: 'Str0ngPass!',
      role: Role.SUPPORT,
    });
    expect(passwords.hash).toHaveBeenCalledWith('Str0ngPass!');
    expect(users.insert).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: '$2b$12$hash', role: Role.SUPPORT, email: null }),
    );
    expect(result.id).toBe(30);
  });
});

describe('UsersService.update', () => {
  it("refuses another user's profile before looking it up", async () => {
    const { service, users } = setup();
    await expect(
      service.update({ ...owner, id: 99 }, 20, { fullName: 'X' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(users.findOneBy).not.toHaveBeenCalled();
  });

  it('refuses role or status changes from a non-admin', async () => {
    const { service } = setup();
    await expect(
      service.update(owner, 20, { role: Role.ADMIN }),
    ).rejects.toThrow('Only an admin can change role or status');
  });

  it('refuses an empty change', async () => {
    const { service } = setup();
    await expect(service.update(owner, 20, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("lets the owner change their own name and email", async () => {
    const { service, users, manager } = setup();
    users.findOneBy.mockResolvedValue(stored());
    await service.update(owner, 20, { fullName: 'Karim Uddin', email: null });
    expect(manager.update).toHaveBeenCalledWith(User, { id: 20 }, {
      fullName: 'Karim Uddin',
      email: null,
    });
  });

  it('answers 404 for a user that does not exist', async () => {
    const { service, users } = setup();
    users.findOneBy.mockResolvedValue(null);
    await expect(
      service.update(admin, 404, { isActive: false }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('stops an admin from demoting or deactivating themselves', async () => {
    const { service, users } = setup();
    users.findOneBy.mockResolvedValue(stored({ id: 1, role: Role.ADMIN }));
    await expect(
      service.update(admin, 1, { role: Role.SUPPORT }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.update(admin, 1, { isActive: false }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses turning an account into a driver or a driver into something else', async () => {
    const { service, users } = setup();
    users.findOneBy.mockResolvedValue(stored({ role: Role.RIDER }));
    await expect(
      service.update(admin, 20, { role: Role.DRIVER }),
    ).rejects.toBeInstanceOf(ConflictException);

    users.findOneBy.mockResolvedValue(stored({ role: Role.DRIVER }));
    await expect(
      service.update(admin, 20, { role: Role.RIDER }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('takes a driver offline when an admin deactivates them', async () => {
    const { service, users, manager } = setup();
    users.findOneBy.mockResolvedValue(stored({ role: Role.DRIVER }));
    await service.update(admin, 20, { isActive: false });
    expect(manager.update).toHaveBeenCalledWith(User, { id: 20 }, { isActive: false });
    expect(manager.update).toHaveBeenCalledWith(DriverProfile, { userId: 20 }, {
      status: DriverAvailability.OFFLINE,
    });
  });
});

describe('UsersService.deactivate', () => {
  it('refuses to deactivate yourself', async () => {
    const { service } = setup();
    await expect(service.deactivate(admin, 1)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('answers 404 for a user that does not exist', async () => {
    const { service, users } = setup();
    users.existsBy.mockResolvedValue(false);
    await expect(service.deactivate(admin, 404)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deactivates the user and takes a driver offline in one transaction', async () => {
    const { service, users, manager } = setup();
    users.existsBy.mockResolvedValue(true);
    await service.deactivate(admin, 20);
    expect(manager.update).toHaveBeenCalledWith(User, { id: 20 }, { isActive: false });
    expect(manager.update).toHaveBeenCalledWith(DriverProfile, { userId: 20 }, {
      status: DriverAvailability.OFFLINE,
    });
  });
});
