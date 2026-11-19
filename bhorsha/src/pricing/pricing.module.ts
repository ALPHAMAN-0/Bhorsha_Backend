import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FareRule } from '../modules/pricing/entities/fare-rule.entity.js';
import { PricingService } from './pricing.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([FareRule])],
  providers: [PricingService],
  exports: [PricingService, TypeOrmModule],
})
export class PricingModule {}
