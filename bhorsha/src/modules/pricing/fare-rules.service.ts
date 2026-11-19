import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import type { Page } from '../../common/dto/page.js';
import type { AuthUser } from '../../common/guards/auth-user.js';
import {
  bpsToPercent,
  paisaToTk,
  percentToBps,
  tkToPaisa,
} from '../../common/money.js';
import type { VehicleType } from '../../fleet/vehicle-type.js';
import type { UpdateFareRuleDto } from './dto/update-fare-rule.dto.js';
import { FareRule } from './entities/fare-rule.entity.js';

/** A fare rule as the API shows it: amounts in Tk, the discount in percent. */
export interface FareRuleView {
  id: number;
  vehicleType: VehicleType;
  baseTk: number;
  perKmTk: number;
  baseDistanceM: number;
  ceilingBaseTk: number;
  ceilingPerKmTk: number;
  shareDiscountPercent: number;
  updatedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toFareRuleView(rule: FareRule): FareRuleView {
  return {
    id: rule.id,
    vehicleType: rule.vehicleType,
    baseTk: paisaToTk(rule.basePaisa),
    perKmTk: paisaToTk(rule.perKmPaisa),
    baseDistanceM: rule.baseDistanceM,
    ceilingBaseTk: paisaToTk(rule.ceilingBasePaisa),
    ceilingPerKmTk: paisaToTk(rule.ceilingPerKmPaisa),
    shareDiscountPercent: bpsToPercent(rule.shareDiscountBps),
    updatedBy: rule.updatedBy,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

@Injectable()
export class FareRulesService {
  constructor(
    @InjectRepository(FareRule) private readonly rules: Repository<FareRule>,
  ) {}

  async list(query: PaginationQueryDto): Promise<Page<FareRuleView>> {
    const { page, limit } = query;
    const [rows, total] = await this.rules.findAndCount({
      order: { id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data: rows.map(toFareRuleView), meta: { page, limit, total } };
  }

  /**
   * Changes the tariff of one vehicle type. The API sends Tk; the database
   * stores paisa. A rate above the legal ceiling is refused with 409 (the
   * database's ck_fare_rules_within_ceiling backs this up through the
   * exception filter).
   */
  async update(
    actor: AuthUser,
    id: number,
    dto: UpdateFareRuleDto,
  ): Promise<FareRuleView> {
    if (
      dto.baseTk === undefined &&
      dto.perKmTk === undefined &&
      dto.shareDiscountPercent === undefined
    ) {
      throw new BadRequestException(
        'Send at least one of baseTk, perKmTk or shareDiscountPercent',
      );
    }
    const rule = await this.rules.findOneBy({ id });
    if (!rule) {
      throw new NotFoundException('Fare rule not found');
    }

    const basePaisa =
      dto.baseTk === undefined ? rule.basePaisa : tkToPaisa(dto.baseTk);
    const perKmPaisa =
      dto.perKmTk === undefined ? rule.perKmPaisa : tkToPaisa(dto.perKmTk);
    const overCeiling = [
      { field: 'baseTk', value: basePaisa, max: rule.ceilingBasePaisa },
      { field: 'perKmTk', value: perKmPaisa, max: rule.ceilingPerKmPaisa },
    ]
      .filter(({ value, max }) => value > max)
      .map(({ field, max }) => ({ field, max: paisaToTk(max) }));
    if (overCeiling.length > 0) {
      throw new ConflictException({
        message: 'Fare is above the legal ceiling',
        details: overCeiling,
      });
    }

    await this.rules.update(
      { id },
      {
        basePaisa,
        perKmPaisa,
        shareDiscountBps:
          dto.shareDiscountPercent === undefined
            ? rule.shareDiscountBps
            : percentToBps(dto.shareDiscountPercent),
        updatedBy: actor.id,
      },
    );
    return toFareRuleView(await this.rules.findOneByOrFail({ id }));
  }
}
