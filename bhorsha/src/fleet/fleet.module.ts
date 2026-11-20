import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PricingModule } from '../pricing/pricing.module.js';
import { DriverRidesController } from './driver-rides.controller.js';
import { DriverRidesService } from './driver-rides.service.js';
import { DriversController } from './drivers.controller.js';
import { DriversService } from './drivers.service.js';
import { DriverProfile } from './entities/driver-profile.entity.js';
import { Vehicle } from './entities/vehicle.entity.js';
import { RideInvitesController } from './ride-invites.controller.js';
import { RideInvitesService } from './ride-invites.service.js';
import { RouteOffersController } from './route-offers.controller.js';
import { RouteOffersService } from './route-offers.service.js';
import { VehiclesController } from './vehicles.controller.js';
import { VehiclesService } from './vehicles.service.js';

@Module({
  // PricingModule: invites quote the same shared fare as a rider's join request.
  imports: [TypeOrmModule.forFeature([DriverProfile, Vehicle]), PricingModule],
  controllers: [
    VehiclesController,
    DriversController,
    DriverRidesController,
    RouteOffersController,
    RideInvitesController,
  ],
  providers: [
    VehiclesService,
    DriversService,
    DriverRidesService,
    RouteOffersService,
    RideInvitesService,
  ],
})
export class FleetModule {}