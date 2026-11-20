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
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/guards/auth-user.js';
import { CreateJoinRequestDto } from './dto/create-join-request.dto.js';
import { JoinRequestsService } from './join-requests.service.js';

/** The rider's side of sharing: find a shared ride or route offer, ask to join, answer. */
@ApiTags('Rider Domain')
@Controller()
export class JoinRequestsController {
  constructor(private readonly joinRequestsService: JoinRequestsService) {}

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
    return this.joinRequestsService.getNearbyOffers(
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
    return this.joinRequestsService.createJoinRequest(user, dto);
  }

  @Get('join-requests/my')
  @ApiOperation({ summary: 'Join requests and invites I sent or received' })
  @ApiHeader({ name: 'x-user-id', description: 'Passenger User ID', required: true, example: '2' })
  findMyJoinRequests(@CurrentUser() user: AuthUser) {
    return this.joinRequestsService.findMyJoinRequests(user);
  }

  @Post('join-requests/:id/accept')
  @ApiOperation({
    summary: "Accept a join request (driver) or an invite (rider): the seat transaction",
  })
  @ApiHeader({ name: 'x-user-id', description: 'Driver (for a request) or rider (for an invite)', required: true, example: '1' })
  acceptJoinRequest(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.joinRequestsService.respondJoinRequest(id, user, true);
  }

  @Post('join-requests/:id/decline')
  @ApiOperation({ summary: 'Decline a join request (driver) or an invite (rider)' })
  @ApiHeader({ name: 'x-user-id', description: 'Driver (for a request) or rider (for an invite)', required: true, example: '1' })
  declineJoinRequest(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.joinRequestsService.respondJoinRequest(id, user, false);
  }
}
