import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ApiDriverDomain } from '../../common/decorators/api-driver-domain.decorator.js';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator.js';
import { CreateInviteDto } from './dto/create-invite.dto.js';
import { RideInvitesService } from './ride-invites.service.js';

@ApiDriverDomain()
@Controller('rides')
export class RideInvitesController {
  constructor(private readonly rideInvitesService: RideInvitesService) {}

  @ApiOperation({ summary: 'Invite a waiting rider to my shared ride' })
  @Post(':id/invites')
  invite(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) rideId: number,
    @Body() dto: CreateInviteDto,
  ) {
    return this.rideInvitesService.invite(userId, rideId, dto);
  }
}