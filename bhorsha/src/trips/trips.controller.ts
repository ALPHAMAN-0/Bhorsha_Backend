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
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { VehicleType } from '../fleet/vehicle-type.js';
import { SafetyService } from '../safety/safety.service.js';
import { CreateJoinRequestDto } from './dto/create-join-request.dto.js';
import { CreateRatingDto } from './dto/create-rating.dto.js';
import { CreateRideDto } from './dto/create-ride.dto.js';
import { FindRidesQueryDto } from './dto/find-rides-query.dto.js';
import { TriggerSosDto } from './dto/trigger-sos.dto.js';
import { RideStatus } from './entities/ride.entity.js';
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
  @ApiQuery({ name: 'vehicle_type', enum: VehicleType, required: false })
  @ApiQuery({ name: 'distance_km', type: Number, required: false, example: 5.0 })
  @ApiQuery({ name: 'is_shared', type: Boolean, required: false, example: false })
  getQuote(
    @Query('vehicle_type') vehicleType?: VehicleType,
    @Query('distance_km') distanceKm?: string,
    @Query('is_shared') isShared?: string,
  ) {
    const vType = vehicleType || VehicleType.CAR;
    const dist = distanceKm ? parseFloat(distanceKm) : 5.0;
    const shared = isShared === 'true' || isShared === '1';
    return this.tripsService.getQuote(vType, dist, shared);
  }

  @Post('rides')
  @ApiOperation({ summary: 'Create and request a new solo or shared ride' })
  @ApiHeader({ name: 'x-user-id', description: 'Rider User ID', required: true, example: '1' })
  createRide(@CurrentUserId() userId: number, @Body() dto: CreateRideDto) {
    return this.tripsService.createRide(userId, dto);
  }

  @Get('rides/my')
  @ApiOperation({ summary: 'List my ride history (as rider or driver)' })
  @ApiHeader({ name: 'x-user-id', description: 'User ID', required: true, example: '1' })
  findMyRides(
    @CurrentUserId() userId: number,
    @Query() query: PaginationQueryDto,
  ) {
    return this.tripsService.findMyRides(userId, query.page, query.limit);
  }

  @Get('rides')
  @ApiOperation({ summary: 'List all platform rides (Support / Admin oversight)' })
  findAllRides(@Query() query: FindRidesQueryDto) {
    return this.tripsService.findAllRides(query.status, query.page, query.limit);
  }

  @Get('rides/:id')
  @ApiOperation({ summary: 'Get details of a specific ride by ID' })
  findOne(@Param('id') id: string) {
    return this.tripsService.findOne(id);
  }

  @Post('rides/:id/cancel')
  @ApiOperation({ summary: 'Cancel a pending or active ride' })
  @ApiHeader({ name: 'x-user-id', description: 'Rider or Driver ID', required: true, example: '1' })
  cancelRide(@CurrentUserId() userId: number, @Param('id') id: string) {
    return this.tripsService.cancelRide(id, userId);
  }

  @Get('route-offers/nearby')
  @ApiOperation({ summary: 'Find nearby shared rides open for carpooling / seat-sharing' })
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
  @ApiOperation({ summary: 'Submit request to join a shared ride' })
  @ApiHeader({ name: 'x-user-id', description: 'Passenger User ID', required: true, example: '2' })
  createJoinRequest(
    @CurrentUserId() userId: number,
    @Body() dto: CreateJoinRequestDto,
  ) {
    return this.tripsService.createJoinRequest(userId, dto);
  }

  @Get('join-requests/my')
  @ApiOperation({ summary: 'View my submitted join requests' })
  @ApiHeader({ name: 'x-user-id', description: 'Passenger User ID', required: true, example: '2' })
  findMyJoinRequests(@CurrentUserId() userId: number) {
    return this.tripsService.findMyJoinRequests(userId);
  }

  @Post('join-requests/:id/accept')
  @ApiOperation({ summary: 'Accept a join request (Atomic Pessimistic Lock for last seat)' })
  @ApiHeader({ name: 'x-user-id', description: 'Ride Host / Driver User ID', required: true, example: '1' })
  acceptJoinRequest(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.tripsService.respondJoinRequest(id, userId, true);
  }

  @Post('join-requests/:id/decline')
  @ApiOperation({ summary: 'Decline a join request' })
  @ApiHeader({ name: 'x-user-id', description: 'Ride Host / Driver User ID', required: true, example: '1' })
  declineJoinRequest(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.tripsService.respondJoinRequest(id, userId, false);
  }

  @Post('ratings')
  @ApiOperation({ summary: 'Submit rating (1-5 stars) for a completed ride' })
  @ApiHeader({ name: 'x-user-id', description: 'Rater User ID', required: true, example: '1' })
  createRating(@CurrentUserId() userId: number, @Body() dto: CreateRatingDto) {
    return this.tripsService.rateRide(userId, dto);
  }

  @Post('rides/:id/sos')
  @ApiOperation({ summary: 'Trigger emergency SOS for a specific ride with SMTP email dispatch' })
  @ApiHeader({ name: 'x-user-id', description: 'Passenger User ID', required: true, example: '1' })
  triggerRideSos(
    @CurrentUserId() userId: number,
    @Param('id') id: string,
    @Body() dto: TriggerSosDto,
  ) {
    return this.safetyService.triggerSos(userId, id, dto.lat, dto.lng);
  }

  @Post('sos')
  @ApiOperation({ summary: 'Trigger general emergency SOS' })
  @ApiHeader({ name: 'x-user-id', description: 'Passenger User ID', required: true, example: '1' })
  triggerGeneralSos(
    @CurrentUserId() userId: number,
    @Body() dto: TriggerSosDto,
  ) {
    return this.safetyService.triggerSos(userId, dto.ride_id, dto.lat, dto.lng);
  }
}
