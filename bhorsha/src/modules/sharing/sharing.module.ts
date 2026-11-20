import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FleetModule } from '../fleet/fleet.module.js';
import { PricingModule } from '../pricing/pricing.module.js';
import { TripsModule } from '../trips/trips.module.js';
import { JoinRequest } from './entities/join-request.entity.js';
import { JoinRequestsController } from './join-requests.controller.js';
import { JoinRequestsService } from './join-requests.service.js';
import { RideInvitesController } from './ride-invites.controller.js';
import { RideInvitesService } from './ride-invites.service.js';
import { RouteOffersController } from './route-offers.controller.js';
import { RouteOffersService } from './route-offers.service.js';

/**
 * Owns route_offers and join_requests: the driver's "going this way" offers and
 * invites, the rider's join requests, and the seat transaction that turns an
 * accepted request into a seat.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([JoinRequest]),
    FleetModule, // only an online driver offers a route or invites a rider
    PricingModule, // the shared fare quoted on a join request or an invite
    TripsModule, // the seat transaction writes rides and ride_passengers through RidesService
  ],
  controllers: [RouteOffersController, RideInvitesController, JoinRequestsController],
  providers: [RouteOffersService, RideInvitesService, JoinRequestsService],
})
export class SharingModule {}
