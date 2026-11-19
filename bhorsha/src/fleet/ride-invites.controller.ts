import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator.js';
import { CreateInviteDto } from './dto/create-invite.dto.js';
import { RideInvitesService } from './ride-invites.service.js';

@ApiTags('Driver Domain')
@ApiHeader({
  name: 'x-user-id',
  description: 'Who is calling (user ID). Leave empty to see 401',
  required: false,
  example: '5',
})
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