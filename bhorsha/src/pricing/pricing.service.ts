import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SEAT_CAPACITY, VehicleType } from '../fleet/vehicle-type.js';
import { bpsToPercent, paisaToTk as toTk } from '../common/money.js';
import { FareRule } from '../modules/pricing/entities/fare-rule.entity.js';

/** All amounts are in Tk (BDT). The database stores paisa; it is converted here (Tk 1 = 100 paisa). */
export interface QuoteResult {
  vehicle_type: VehicleType;
  distance_km: number;
  is_shared: boolean;
  base_fare_bdt: number;
  base_distance_km: number;
  per_km_bdt: number;
  subtotal_bdt: number;
  shared_fare_bdt: number;
  share_discount_percent: number;
  surge_multiplier: number;
  total_fare_bdt: number;
  fare_share_bdt: number;
  brta_ceiling_bdt: number;
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
    // A one-seat vehicle (BIKE) is never shared: the database's ck_rides_bike_solo refuses it too.
    if (isShared && SEAT_CAPACITY[vehicleType] < 2) {
      throw new BadRequestException(
        `A ${vehicleType} ride can't be shared: it has room for only one rider`,
      );
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
      base_fare_bdt: toTk(rule.basePaisa),
      base_distance_km: rule.baseDistanceM / 1000,
      per_km_bdt: toTk(rule.perKmPaisa),
      subtotal_bdt: toTk(soloPaisa),
      shared_fare_bdt: toTk(sharedPaisa),
      share_discount_percent: bpsToPercent(rule.shareDiscountBps),
      surge_multiplier: 1.0,
      total_fare_bdt: toTk(soloLockedPaisa),
      fare_share_bdt: toTk(lockedPaisa),
      brta_ceiling_bdt: toTk(ceilingPaisa),
      currency: 'BDT',
    };
  }
}
