import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../common/guards/auth-user.js';
import { VehicleType } from '../../fleet/vehicle-type.js';
import { Role } from '../../users/entities/user.entity.js';
import type { FareRule } from './entities/fare-rule.entity.js';
import { FareRulesService } from './fare-rules.service.js';

const admin: AuthUser = { id: 1, role: Role.ADMIN, suspendedUntil: null };
const NOW = new Date('2026-11-19T10:00:00Z');

function carRule(overrides: Partial<FareRule> = {}): FareRule {
  return {
    id: 2,
    vehicleType: VehicleType.CAR,
    basePaisa: 8000,
    perKmPaisa: 3000,
    baseDistanceM: 2000,
    ceilingBasePaisa: 8500,
    ceilingPerKmPaisa: 3400,
    shareDiscountBps: 2500,
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function setup() {
  const rules = {
    findAndCount: vi.fn().mockResolvedValue([[carRule()], 1]),
    findOneBy: vi.fn(),
    findOneByOrFail: vi.fn(),
    update: vi.fn(),
  };
  return { service: new FareRulesService(rules as never), rules };
}

describe('FareRulesService', () => {
  it('lists the rules in id order', async () => {
    const { service, rules } = setup();
    const result = await service.list({ page: 1, limit: 10 });
    expect(rules.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ order: { id: 'ASC' }, skip: 0, take: 10 }),
    );
    expect(result.meta).toEqual({ page: 1, limit: 10, total: 1 });
  });

  it('shows amounts in Tk and the discount in percent', async () => {
    const { service } = setup();
    const result = await service.list({ page: 1, limit: 10 });
    expect(result.data[0]).toMatchObject({
      baseTk: 80,
      perKmTk: 30,
      ceilingBaseTk: 85,
      ceilingPerKmTk: 34,
      shareDiscountPercent: 25,
    });
    expect(result.data[0]).not.toHaveProperty('basePaisa');
  });

  it('refuses an empty change', async () => {
    const { service } = setup();
    await expect(service.update(admin, 2, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('answers 404 for an unknown rule', async () => {
    const { service, rules } = setup();
    rules.findOneBy.mockResolvedValue(null);
    await expect(
      service.update(admin, 9, { baseTk: 80 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a rate above the legal ceiling with 409 and says which', async () => {
    const { service, rules } = setup();
    rules.findOneBy.mockResolvedValue(carRule());

    const attempt = service.update(admin, 2, { perKmTk: 34.01 });

    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    await attempt.catch((error: ConflictException) => {
      expect(error.getResponse()).toEqual({
        message: 'Fare is above the legal ceiling',
        details: [{ field: 'perKmTk', max: 34 }],
      });
    });
    expect(rules.update).not.toHaveBeenCalled();
  });

  it('accepts a rate exactly at the ceiling and records the admin', async () => {
    const { service, rules } = setup();
    rules.findOneBy.mockResolvedValue(carRule());
    rules.findOneByOrFail.mockResolvedValue(carRule({ basePaisa: 8500, updatedBy: 1 }));

    const result = await service.update(admin, 2, { baseTk: 85 });

    expect(rules.update).toHaveBeenCalledWith(
      { id: 2 },
      { basePaisa: 8500, perKmPaisa: 3000, shareDiscountBps: 2500, updatedBy: 1 },
    );
    expect(result.updatedBy).toBe(1);
    expect(result.baseTk).toBe(85);
  });

  it('stores Tk and percent as paisa and basis points', async () => {
    const { service, rules } = setup();
    rules.findOneBy.mockResolvedValue(carRule());
    rules.findOneByOrFail.mockResolvedValue(carRule());

    await service.update(admin, 2, { perKmTk: 0.29, shareDiscountPercent: 12.5 });

    expect(rules.update).toHaveBeenCalledWith(
      { id: 2 },
      { basePaisa: 8000, perKmPaisa: 29, shareDiscountBps: 1250, updatedBy: 1 },
    );
  });
});
