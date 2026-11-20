import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VehicleType } from '../fleet/vehicle-type.js';
import type { FareRule } from './entities/fare-rule.entity.js';
import { PricingService } from './pricing.service.js';

const NOW = new Date('2026-11-19T10:00:00Z');

function rule(vehicleType: VehicleType, overrides: Partial<FareRule> = {}): FareRule {
  return {
    id: 2,
    vehicleType,
    basePaisa: 6000,
    perKmPaisa: 2500,
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

function setup(found: FareRule | null) {
  const fareRules = { findOne: vi.fn().mockResolvedValue(found) };
  return { service: new PricingService(fareRules as never), fareRules };
}

describe('PricingService.calculateQuote', () => {
  it('matches the documented 10 km car example in Tk (260 solo, 195 shared, 357 ceiling)', async () => {
    const { service } = setup(rule(VehicleType.CAR));
    const solo = await service.calculateQuote(VehicleType.CAR, 10, false);
    const shared = await service.calculateQuote(VehicleType.CAR, 10, true);

    expect(solo).toMatchObject({
      subtotal_bdt: 260,
      shared_fare_bdt: 195,
      brta_ceiling_bdt: 357,
      fare_share_bdt: 260,
      share_discount_percent: 25,
    });
    expect(shared.fare_share_bdt).toBe(195);
  });

  it('charges only the base fare inside the base distance', async () => {
    const { service } = setup(rule(VehicleType.CAR));
    const quote = await service.calculateQuote(VehicleType.CAR, 1.5, false);
    expect(quote.subtotal_bdt).toBe(60);
  });

  it('never charges more than the legal ceiling', async () => {
    const { service } = setup(rule(VehicleType.CAR, { basePaisa: 9000 }));
    const quote = await service.calculateQuote(VehicleType.CAR, 2, false);
    expect(quote.total_fare_bdt).toBe(85);
  });

  it('refuses a shared BIKE ride before looking up the fare', async () => {
    const { service, fareRules } = setup(rule(VehicleType.BIKE));
    await expect(
      service.calculateQuote(VehicleType.BIKE, 5, true),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fareRules.findOne).not.toHaveBeenCalled();
  });

  it('still quotes a solo BIKE ride', async () => {
    const { service } = setup(
      rule(VehicleType.BIKE, { basePaisa: 3000, perKmPaisa: 1200, ceilingBasePaisa: 4000, ceilingPerKmPaisa: 1800 }),
    );
    const quote = await service.calculateQuote(VehicleType.BIKE, 5, false);
    expect(quote.fare_share_bdt).toBe(66);
  });

  it.each([0, -3, Number.NaN])('refuses distance %s', async (distance) => {
    const { service } = setup(rule(VehicleType.CAR));
    await expect(
      service.calculateQuote(VehicleType.CAR, distance, false),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('answers 404 when a vehicle type has no fare rule', async () => {
    const { service } = setup(null);
    await expect(
      service.calculateQuote(VehicleType.CNG, 5, false),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
