import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PricingModule } from '../pricing/pricing.module.js';
import { SafetyModule } from '../safety/safety.module.js';
import { JoinRequest } from './entities/join-request.entity.js';
import { Rating } from './entities/rating.entity.js';
import { RidePassenger } from './entities/ride-passenger.entity.js';
import { Ride } from './entities/ride.entity.js';
import { TripsController } from './trips.controller.js';
import { TripsService } from './trips.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ride, RidePassenger, JoinRequest, Rating]),
    PricingModule,
    SafetyModule,
  ],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService, TypeOrmModule],
})
export class TripsModule {}
