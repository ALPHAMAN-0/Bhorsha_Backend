import { Module } from '@nestjs/common';
import { RidesController } from './rides.controller.js';
import { RidesService } from './rides.service.js';
import { RatingsController } from './ratings.controller.js';
import { RatingsService } from './ratings.service.js';

@Module({
  controllers: [RidesController, RatingsController],
  providers: [RidesService, RatingsService]
})
export class TripsModule {}
