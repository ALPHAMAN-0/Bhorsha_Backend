import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator.js';
import { CreateInviteDto } from './dto/create-invite.dto.js';
import { RideInvitesService } from './ride-invites.service.js';

@Controller('rides')
export class RideInvitesController {
  constructor(private readonly rideInvitesService: RideInvitesService) {}

  @Post(':id/invites')
  invite(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) rideId: number,
    @Body() dto: CreateInviteDto,
  ) {
    return this.rideInvitesService.invite(userId, rideId, dto);
  }
}