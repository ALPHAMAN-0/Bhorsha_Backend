import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VehicleType } from '../fleet/vehicle-type.js';
import { FareRule } from '../modules/pricing/entities/fare-rule.entity.js';

export interface QuoteResult {
  vehicle_type: VehicleType;
  distance_km: number;
  is_shared: boolean;
  base_fare_bdt: number;
  per_km_bdt: number;
  base_distance_km: number;
  subtotal_bdt: number;
  surge_multiplier: number;
  total_fare_bdt: number;
  fare_share_bdt: number;
  brta_ceiling_bdt: number;
  share_discount_bps: number;
  solo_fare_paisa: number;
  shared_fare_paisa: number;
  ceiling_paisa: number;
  locked_fare_paisa: number;
  currency: string;
}

@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(FareRule)
    private readonly fareRuleRepo: Repository<FareRule>,
  ) {}

  /**
   * Fare formula from doc/databaseSQL.md (fare_rules), for a passenger's own distance d in metres:
   *   solo    = base_paisa         + round(per_km_paisa         * max(d - base_distance_m, 0) / 1000)
   *   ceiling = ceiling_base_paisa + round(ceiling_per_km_paisa * max(d - base_distance_m, 0) / 1000)
   *   shared  = round(solo * (10000 - share_discount_bps) / 10000)
   *   locked  = min(shared or solo, ceiling)
   */
  async calculateQuote(
    vehicleType: VehicleType,
    distanceKm: number,
    isShared: boolean = false,
  ): Promise<QuoteResult> {
    if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
      throw new BadRequestException('distance_km must be a positive number');
    }

    const rule = await this.fareRuleRepo.findOne({ where: { vehicleType } });
    if (!rule) {
      throw new NotFoundException(`No fare rule for vehicle type ${vehicleType}`);
    }

    const distanceM = Math.round(distanceKm * 1000);
    const extraM = Math.max(distanceM - rule.baseDistanceM, 0);

    const soloPaisa = rule.basePaisa + Math.round((rule.perKmPaisa * extraM) / 1000);
    const ceilingPaisa =
      rule.ceilingBasePaisa + Math.round((rule.ceilingPerKmPaisa * extraM) / 1000);
    const sharedPaisa = Math.round((soloPaisa * (10000 - rule.shareDiscountBps)) / 10000);

    const soloLockedPaisa = Math.min(soloPaisa, ceilingPaisa);
    const lockedPaisa = Math.min(isShared ? sharedPaisa : soloPaisa, ceilingPaisa);

    return {
      vehicle_type: vehicleType,
      distance_km: distanceKm,
      is_shared: isShared,
      base_fare_bdt: rule.basePaisa / 100,
      per_km_bdt: rule.perKmPaisa / 100,
      base_distance_km: rule.baseDistanceM / 1000,
      subtotal_bdt: soloPaisa / 100,
      surge_multiplier: 1.0,
      total_fare_bdt: soloLockedPaisa / 100,
      fare_share_bdt: lockedPaisa / 100,
      brta_ceiling_bdt: ceilingPaisa / 100,
      share_discount_bps: rule.shareDiscountBps,
      solo_fare_paisa: soloPaisa,
      shared_fare_paisa: sharedPaisa,
      ceiling_paisa: ceilingPaisa,
      locked_fare_paisa: lockedPaisa,
      currency: 'BDT',
    };
  }
}
