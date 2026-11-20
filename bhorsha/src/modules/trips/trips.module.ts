import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FleetModule } from '../fleet/fleet.module.js';
import { PricingModule } from '../pricing/pricing.module.js';
import { DriverRidesController } from './driver-rides.controller.js';
import { DriverRidesService } from './driver-rides.service.js';
import { Rating } from './entities/rating.entity.js';
import { RidePassenger } from './entities/ride-passenger.entity.js';
import { Ride } from './entities/ride.entity.js';
import { RatingsController } from './ratings.controller.js';
import { RatingsService } from './ratings.service.js';
import { RidesController } from './rides.controller.js';
import { RidesService } from './rides.service.js';

/**
 * Owns rides, ride_passengers and ratings: the ride state machine from both
 * sides (the rider books and cancels; the driver accepts, arrives, picks up and
 * drops off) and ratings.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Ride, RidePassenger, Rating]),
    FleetModule, // the driver's profile and vehicle types
    PricingModule, // fares for quotes and bookings
  ],
  // DriverRidesController first: GET /rides/open must be registered before GET /rides/:id.
  controllers: [DriverRidesController, RidesController, RatingsController],
  providers: [RidesService, DriverRidesService, RatingsService],
  // Sharing's seat transaction writes rides and ride_passengers through RidesService;
  // safety checks that an SOS sender is on the ride with RidesService.findOne.
  exports: [RidesService],
})
export class TripsModule {}
