import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { DriverProfile } from '../../fleet/entities/driver-profile.entity.js';
import { Role, User } from '../../users/entities/user.entity.js';
import { AuthService } from './auth.service.js';
import type { RegisterDto } from './dto/register.dto.js';

const NOW = new Date('2026-11-19T10:00:00Z');

function storedUser(overrides: Partial<User> = {}): User {
  return {
    id: 7,
    fullName: 'Rahim Uddin',
    phone: '+8801712345678',
    email: null,
    passwordHash: '$2b$12$stored-hash',
    role: Role.RIDER,
    isActive: true,
    suspendedUntil: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function setup() {
  const runner = {
    connect: vi.fn(),
    startTransaction: vi.fn(),
    commitTransaction: vi.fn(),
    rollbackTransaction: vi.fn(),
    release: vi.fn(),
    manager: {
      insert: vi.fn().mockResolvedValue({ identifiers: [{ id: 7 }] }),
    },
  };
  const loginQuery = {
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    getOne: vi.fn(),
  };
  const users = {
    findOneByOrFail: vi.fn(),
    createQueryBuilder: vi.fn(() => loginQuery),
  };
  const drivers = { findOneBy: vi.fn() };
  const dataSource = { createQueryRunner: vi.fn(() => runner) };
  const jwt = { signAsync: vi.fn().mockResolvedValue('signed.jwt.token') };
  const passwords = {
    hash: vi.fn().mockResolvedValue('$2b$12$new-hash'),
    compare: vi.fn(),
    compareWithDummy: vi.fn(),
  };
  const config = { get: vi.fn((_key: string, fallback: unknown) => fallback) };
  const service = new AuthService(
    users as never,
    drivers as never,
    dataSource as never,
    jwt as never,
    passwords as never,
    config as never,
  );
  return { service, runner, users, drivers, jwt, passwords, loginQuery };
}

const rider: RegisterDto = {
  fullName: 'Rahim Uddin',
  phone: '+8801712345678',
  password: 'Str0ngPass!',
  role: Role.RIDER,
};

describe('AuthService.register', () => {
  it('creates a rider in one insert and never returns the hash', async () => {
    const { service, runner, users, passwords } = setup();
    users.findOneByOrFail.mockResolvedValue(storedUser());

    const result = await service.register(rider);

    expect(passwords.hash).toHaveBeenCalledWith('Str0ngPass!');
    expect(runner.manager.insert).toHaveBeenCalledTimes(1);
    expect(runner.manager.insert).toHaveBeenCalledWith(User, {
      fullName: 'Rahim Uddin',
      phone: '+8801712345678',
      email: null,
      passwordHash: '$2b$12$new-hash',
      role: Role.RIDER,
    });
    expect(runner.commitTransaction).toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
    expect(result.driverProfile).toBeNull();
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('creates a driver and the driver profile in the same transaction', async () => {
    const { service, runner, users, drivers } = setup();
    users.findOneByOrFail.mockResolvedValue(storedUser({ role: Role.DRIVER }));
    drivers.findOneBy.mockResolvedValue({
      userId: 7,
      licenceNo: 'DK-0123456789',
      verification: 'PENDING',
      status: 'OFFLINE',
    });

    const result = await service.register({
      ...rider,
      role: Role.DRIVER,
      licenceNo: 'DK-0123456789',
    });

    expect(runner.manager.insert).toHaveBeenNthCalledWith(2, DriverProfile, {
      userId: 7,
      licenceNo: 'DK-0123456789',
    });
    expect(runner.startTransaction).toHaveBeenCalledTimes(1);
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(result.driverProfile).toEqual({
      licenceNo: 'DK-0123456789',
      verification: 'PENDING',
      status: 'OFFLINE',
    });
  });

  it('rolls back the user when the licence number is taken', async () => {
    const { service, runner } = setup();
    const taken = new QueryFailedError(
      'INSERT INTO driver_profiles ...',
      [],
      Object.assign(new Error('duplicate'), {
        code: '23505',
        constraint: 'uq_driver_profiles_licence_no',
      }),
    );
    runner.manager.insert
      .mockResolvedValueOnce({ identifiers: [{ id: 7 }] })
      .mockRejectedValueOnce(taken);

    await expect(
      service.register({ ...rider, role: Role.DRIVER, licenceNo: 'DK-1' }),
    ).rejects.toBe(taken);

    expect(runner.rollbackTransaction).toHaveBeenCalled();
    expect(runner.commitTransaction).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
  });

  it('refuses a licence number on a rider account', async () => {
    const { service, passwords } = setup();
    await expect(
      service.register({ ...rider, licenceNo: 'DK-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(passwords.hash).not.toHaveBeenCalled();
  });
});

describe('AuthService.login', () => {
  const credentials = { phone: '+8801712345678', password: 'Str0ngPass!' };

  it('answers an unknown phone like a wrong password, after a dummy compare', async () => {
    const { service, loginQuery, passwords } = setup();
    loginQuery.getOne.mockResolvedValue(null);

    await expect(service.login(credentials)).rejects.toThrow(
      new UnauthorizedException('Invalid phone or password'),
    );
    expect(passwords.compareWithDummy).toHaveBeenCalledWith('Str0ngPass!');
  });

  it('rejects a wrong password with 401', async () => {
    const { service, loginQuery, passwords } = setup();
    loginQuery.getOne.mockResolvedValue(storedUser());
    passwords.compare.mockResolvedValue(false);

    await expect(service.login(credentials)).rejects.toThrow(
      new UnauthorizedException('Invalid phone or password'),
    );
  });

  it('rejects a deactivated account with 403 once the password matched', async () => {
    const { service, loginQuery, passwords, jwt } = setup();
    loginQuery.getOne.mockResolvedValue(storedUser({ isActive: false }));
    passwords.compare.mockResolvedValue(true);

    await expect(service.login(credentials)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('returns a token for the right password, without the hash', async () => {
    const { service, loginQuery, passwords, jwt } = setup();
    loginQuery.getOne.mockResolvedValue(storedUser({ role: Role.ADMIN }));
    passwords.compare.mockResolvedValue(true);

    const result = await service.login(credentials);

    expect(loginQuery.addSelect).toHaveBeenCalledWith('u.passwordHash');
    expect(passwords.compare).toHaveBeenCalledWith(
      'Str0ngPass!',
      '$2b$12$stored-hash',
    );
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 7, role: Role.ADMIN });
    expect(result).toMatchObject({
      accessToken: 'signed.jwt.token',
      tokenType: 'Bearer',
      expiresIn: '15m',
    });
    expect(result.user).not.toHaveProperty('passwordHash');
  });
});
