import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FareRule } from './entities/fare-rule.entity.js';
import { FareRulesController } from './fare-rules.controller.js';
import { FareRulesService } from './fare-rules.service.js';
import { PricingService } from './pricing.service.js';

/**
 * Owns fare_rules: the admin's fare rules (GET/PATCH /fare-rules) and
 * PricingService, which prices every quote, booking, join request and invite
 * from those rules.
 */
@Module({
  imports: [TypeOrmModule.forFeature([FareRule])],
  controllers: [FareRulesController],
  providers: [FareRulesService, PricingService],
  exports: [PricingService],
})
export class PricingModule {}
