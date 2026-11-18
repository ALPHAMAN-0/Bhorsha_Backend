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
import type { UpdateFareRuleDto } from './dto/update-fare-rule.dto.js';
import { FareRule } from './entities/fare-rule.entity.js';

@Injectable()
export class FareRulesService {
  constructor(
    @InjectRepository(FareRule) private readonly rules: Repository<FareRule>,
  ) {}

  async list(query: PaginationQueryDto): Promise<Page<FareRule>> {
    const { page, limit } = query;
    const [data, total] = await this.rules.findAndCount({
      order: { id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { page, limit, total } };
  }

  /**
   * Changes the tariff of one vehicle type. A rate above the legal ceiling is
   * refused with 409 (the database's ck_fare_rules_within_ceiling backs this
   * up through the exception filter).
   */
  async update(
    actor: AuthUser,
    id: number,
    dto: UpdateFareRuleDto,
  ): Promise<FareRule> {
    if (
      dto.basePaisa === undefined &&
      dto.perKmPaisa === undefined &&
      dto.shareDiscountBps === undefined
    ) {
      throw new BadRequestException(
        'Send at least one of basePaisa, perKmPaisa or shareDiscountBps',
      );
    }
    const rule = await this.rules.findOneBy({ id });
    if (!rule) {
      throw new NotFoundException('Fare rule not found');
    }

    const basePaisa = dto.basePaisa ?? rule.basePaisa;
    const perKmPaisa = dto.perKmPaisa ?? rule.perKmPaisa;
    const overCeiling = [
      { field: 'basePaisa', value: basePaisa, max: rule.ceilingBasePaisa },
      { field: 'perKmPaisa', value: perKmPaisa, max: rule.ceilingPerKmPaisa },
    ]
      .filter(({ value, max }) => value > max)
      .map(({ field, max }) => ({ field, max }));
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
        shareDiscountBps: dto.shareDiscountBps ?? rule.shareDiscountBps,
        updatedBy: actor.id,
      },
    );
    return this.rules.findOneByOrFail({ id });
  }
}
