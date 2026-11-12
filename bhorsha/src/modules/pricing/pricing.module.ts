import { Module } from '@nestjs/common';
import { FareRulesController } from './fare-rules.controller.js';
import { FareRulesService } from './fare-rules.service.js';

@Module({
  controllers: [FareRulesController],
  providers: [FareRulesService]
})
export class PricingModule {}
