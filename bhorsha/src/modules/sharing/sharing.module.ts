import { Module } from '@nestjs/common';
import { RouteOffersController } from './route-offers.controller.js';
import { RouteOffersService } from './route-offers.service.js';
import { JoinRequestsController } from './join-requests.controller.js';
import { JoinRequestsService } from './join-requests.service.js';

@Module({
  controllers: [RouteOffersController, JoinRequestsController],
  providers: [RouteOffersService, JoinRequestsService]
})
export class SharingModule {}
