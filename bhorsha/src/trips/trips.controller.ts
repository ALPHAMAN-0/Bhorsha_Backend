import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ApiPagination } from '../common/dto/page.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import type { AuthUser } from '../common/guards/auth-user.js';
import { SafetyService } from '../safety/safety.service.js';
import { Role } from '../users/entities/user.entity.js';
import { CreateJoinRequestDto } from './dto/create-join-request.dto.js';
import { CreateRatingDto } from './dto/create-rating.dto.js';
import { CreateRideDto } from './dto/create-ride.dto.js';
import { FindRidesQueryDto } from './dto/find-rides-query.dto.js';
import { QuoteQueryDto } from './dto/quote-query.dto.js';
import { SosLocationDto, TriggerSosDto } from './dto/trigger-sos.dto.js';
import { TripsService } from './trips.service.js';

@ApiTags('Rider Domain')
@Controller()
export class TripsController {
  constructor(
    private readonly tripsService: TripsService,
    private readonly safetyService: SafetyService,
  ) {}

  @Get('rides/quote')
  @ApiOperation({ summary: 'Calculate upfront fare quote with BRTA legal ceiling rules' })
  getQuote(@Query() query: QuoteQueryDto) {
    return this.tripsService.getQuote(query.vehicle_type, query.distance_km, query.is_shared);
  }

  @Post('rides')
  @ApiOperation({
    summary: 'Book a solo or shared ride (Rider)',
    description:
      'Creates a REQUESTED ride and your seat on it, with the fare locked in Tk and a 4-digit pickup PIN ' +
      'to tell the driver. Booking again replaces your own ride that no driver has accepted yet.',
  })
  @ApiHeader({ name: 'x-user-id', description: 'Rider User ID', required: true, example: '1' })
  createRide(@CurrentUser() user: AuthUser, @Body() dto: CreateRideDto) {
    return this.tripsService.createRide(user, dto);
  }

  @Get('rides/my')
  @ApiPagination()
  @ApiOperation({ summary: 'List my rides, newest first (as rider or driver)' })
  @ApiHeader({ name: 'x-user-id', description: 'User ID', required: true, example: '1' })
  findMyRides(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.tripsService.findMyRides(user, query.page, query.limit);
  }

  @Get('rides')
  @Roles(Role.ADMIN, Role.SUPPORT)
  @ApiPagination()
  @ApiOperation({ summary: 'List all platform rides (Support / Admin oversight)' })
  findAllRides(@CurrentUser() user: AuthUser, @Query() query: FindRidesQueryDto) {
    return this.tripsService.findAllRides(user, query.status, query.page, query.limit);
  }

  @Get('rides/:id')
  @ApiOperation({ summary: 'Get one ride (its riders, its driver, or Admin / Support)' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.tripsService.findOne(user, id);
  }

  @Post('rides/:id/cancel')
  @ApiOperation({
    summary: 'Cancel: a rider cancels their seat before pickup; the driver cancels the whole ride',
  })
  @ApiHeader({ name: 'x-user-id', description: 'Rider or Driver ID', required: true, example: '1' })
  cancelRide(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.tripsService.cancelRide(user, id);
  }

  @Get('route-offers/nearby')
  @ApiOperation({
    summary: 'Find nearby shared rides with free seats and open driver route offers to join',
  })
  @ApiQuery({ name: 'lat', type: Number, required: false, example: 23.8103 })
  @ApiQuery({ name: 'lng', type: Number, required: false, example: 90.4125 })
  @ApiQuery({ name: 'radius_km', type: Number, required: false, example: 5.0 })
  getNearbyOffers(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radius_km') radiusKm?: string,
  ) {
    return this.tripsService.getNearbyOffers(
      lat ? parseFloat(lat) : undefined,
      lng ? parseFloat(lng) : undefined,
      radiusKm ? parseFloat(radiusKm) : undefined,
    );
  }

  @Post('join-requests')
  @ApiOperation({
    summary: "Ask to join a driver's shared ride or route offer (Rider)",
    description:
      'Send exactly one of ride_id or route_offer_id. The shared fare is quoted in Tk and locked if the driver accepts.',
  })
  @ApiHeader({ name: 'x-user-id', description: 'Passenger User ID', required: true, example: '2' })
  createJoinRequest(@CurrentUser() user: AuthUser, @Body() dto: CreateJoinRequestDto) {
    return this.tripsService.createJoinRequest(user, dto);
  }

  @Get('join-requests/my')
  @ApiOperation({ summary: 'Join requests and invites I sent or received' })
  @ApiHeader({ name: 'x-user-id', description: 'Passenger User ID', required: true, example: '2' })
  findMyJoinRequests(@CurrentUser() user: AuthUser) {
    return this.tripsService.findMyJoinRequests(user);
  }

  @Post('join-requests/:id/accept')
  @ApiOperation({
    summary: "Accept a join request (driver) or an invite (rider): the seat transaction",
  })
  @ApiHeader({ name: 'x-user-id', description: 'Driver (for a request) or rider (for an invite)', required: true, example: '1' })
  acceptJoinRequest(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.tripsService.respondJoinRequest(id, user, true);
  }

  @Post('join-requests/:id/decline')
  @ApiOperation({ summary: 'Decline a join request (driver) or an invite (rider)' })
  @ApiHeader({ name: 'x-user-id', description: 'Driver (for a request) or rider (for an invite)', required: true, example: '1' })
  declineJoinRequest(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.tripsService.respondJoinRequest(id, user, false);
  }

  @Post('ratings')
  @ApiOperation({ summary: 'Rate the driver or a co-rider (1-5 stars) after the trip' })
  @ApiHeader({ name: 'x-user-id', description: 'Rater User ID', required: true, example: '1' })
  createRating(@CurrentUser() user: AuthUser, @Body() dto: CreateRatingDto) {
    return this.tripsService.rateRide(user, dto);
  }

  @Post('rides/:id/sos')
  @ApiOperation({
    summary: 'Send an SOS for a ride you are on (emailed to the safety inbox)',
    description:
      '404 if the ride does not exist, 403 if you are not its driver or one of its riders, ' +
      '503 if the email could not be sent.',
  })
  @ApiHeader({ name: 'x-user-id', description: 'Passenger User ID', required: true, example: '1' })
  async triggerRideSos(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SosLocationDto,
  ) {
    const ride = await this.tripsService.findOne(user, id);
    return this.safetyService.triggerSos(user.id, ride, dto.lat, dto.lng);
  }

  @Post('sos')
  @ApiOperation({
    summary: 'Send an SOS, with or without a ride (emailed to the safety inbox)',
    description:
      'ride_id is optional. When given, it must be a ride you are on (404 / 403 otherwise). ' +
      '503 if the email could not be sent.',
  })
  @ApiHeader({ name: 'x-user-id', description: 'Passenger User ID', required: true, example: '1' })
  async triggerGeneralSos(@CurrentUser() user: AuthUser, @Body() dto: TriggerSosDto) {
    const ride = dto.ride_id ? await this.tripsService.findOne(user, dto.ride_id) : null;
    return this.safetyService.triggerSos(user.id, ride, dto.lat, dto.lng);
  }
}
