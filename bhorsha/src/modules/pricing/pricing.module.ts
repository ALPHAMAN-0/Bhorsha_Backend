import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FareRule } from './entities/fare-rule.entity.js';
import { FareRulesController } from './fare-rules.controller.js';
import { FareRulesService } from './fare-rules.service.js';

/**
 * Admin fare rules (GET/PATCH /fare-rules). Imported in AppModule as
 * FareRulesModule, because the rider's quote module in src/pricing is also
 * called PricingModule.
 */
@Module({
  imports: [TypeOrmModule.forFeature([FareRule])],
  controllers: [FareRulesController],
  providers: [FareRulesService],
})
export class PricingModule {}
