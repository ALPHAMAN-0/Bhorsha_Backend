import { Injectable, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VehicleType } from '../fleet/vehicle-type.js';
import { FareRule } from './entities/fare-rule.entity.js';

export interface QuoteResult {
  vehicle_type: VehicleType;
  distance_km: number;
  base_fare_bdt: number;
  per_km_bdt: number;
  subtotal_bdt: number;
  surge_multiplier: number;
  total_fare_bdt: number;
  fare_share_bdt: number;
  brta_ceiling_bdt: number;
  currency: string;
}

@Injectable()
export class PricingService implements OnModuleInit {
  constructor(
    @InjectRepository(FareRule)
    private readonly fareRuleRepo: Repository<FareRule>,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.fareRuleRepo.count();
    if (count === 0) {
      await this.fareRuleRepo.save([
        this.fareRuleRepo.create({
          vehicle_type: VehicleType.CAR,
          base_fare: 8500, // 85.00 BDT
          per_km_rate: 3400, // 34.00 BDT/km
          max_multiplier: 1.2,
          is_active: true,
        }),
        this.fareRuleRepo.create({
          vehicle_type: VehicleType.BIKE,
          base_fare: 5000, // 50.00 BDT
          per_km_rate: 1800, // 18.00 BDT/km
          max_multiplier: 1.2,
          is_active: true,
        }),
        this.fareRuleRepo.create({
          vehicle_type: VehicleType.CNG,
          base_fare: 6000, // 60.00 BDT
          per_km_rate: 2200, // 22.00 BDT/km
          max_multiplier: 1.2,
          is_active: true,
        }),
      ]);
    }
  }

  async calculateQuote(
    vehicleType: VehicleType,
    distanceKm: number,
    isShared: boolean = false,
  ): Promise<QuoteResult> {
    const rule = await this.fareRuleRepo.findOne({
      where: { vehicle_type: vehicleType, is_active: true },
    });

    const baseFarePaisa = rule ? rule.base_fare : 8500;
    const perKmPaisa = rule ? rule.per_km_rate : 3400;
    const maxMultiplier = rule ? Number(rule.max_multiplier) : 1.2;

    const baseFareBdt = baseFarePaisa / 100;
    const perKmBdt = perKmPaisa / 100;
    const subtotalBdt = Math.round((baseFareBdt + distanceKm * perKmBdt) * 100) / 100;

    // Normal multiplier 1.0 (capped at BRTA ceiling)
    const surgeMultiplier = 1.0;
    const effectiveMultiplier = Math.min(surgeMultiplier, maxMultiplier);
    const totalFareBdt = Math.round(subtotalBdt * effectiveMultiplier);

    // If shared, each seat gets 60% of solo fare
    const fareShareBdt = isShared ? Math.round(totalFareBdt * 0.6) : totalFareBdt;
    const brtaCeilingBdt = Math.round(subtotalBdt * maxMultiplier);

    return {
      vehicle_type: vehicleType,
      distance_km: distanceKm,
      base_fare_bdt: baseFareBdt,
      per_km_bdt: perKmBdt,
      subtotal_bdt: subtotalBdt,
      surge_multiplier: effectiveMultiplier,
      total_fare_bdt: totalFareBdt,
      fare_share_bdt: fareShareBdt,
      brta_ceiling_bdt: brtaCeilingBdt,
      currency: 'BDT',
    };
  }
}
