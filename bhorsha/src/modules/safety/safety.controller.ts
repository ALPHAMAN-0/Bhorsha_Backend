import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/guards/auth-user.js';
import { RidesService } from '../trips/rides.service.js';
import { SOS_EXAMPLES, SosLocationDto, TriggerSosDto } from './dto/trigger-sos.dto.js';
import { SafetyService } from './safety.service.js';

/** SOS alerts. For an alert about a ride, trips checks that the sender is on it. */
@ApiTags('Rider Domain')
@Controller()
export class SafetyController {
  constructor(
    private readonly ridesService: RidesService,
    private readonly safetyService: SafetyService,
  ) {}

  @Post('rides/:id/sos')
  @ApiOperation({
    summary: 'Send an SOS for a ride you are on (emailed to the safety inbox)',
    description:
      '404 if the ride does not exist, 403 if you are not its driver or one of its riders, ' +
      '503 if the email could not be sent.',
  })
  @ApiHeader({ name: 'x-user-id', description: 'Passenger User ID', required: false, example: '3' })
  async triggerRideSos(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SosLocationDto,
  ) {
    const ride = await this.ridesService.findOne(user, id);
    return this.safetyService.triggerSos(user.id, ride, dto.lat, dto.lng);
  }

  @Post('sos')
  @ApiOperation({
    summary: 'Send an SOS, with or without a ride (emailed to the safety inbox)',
    description:
      'ride_id is optional. When given, it must be a ride you are on (404 / 403 otherwise). ' +
      '503 if the email could not be sent.',
  })
  @ApiBody({ type: TriggerSosDto, examples: SOS_EXAMPLES })
  @ApiHeader({ name: 'x-user-id', description: 'Passenger User ID', required: false, example: '3' })
  async triggerGeneralSos(@CurrentUser() user: AuthUser, @Body() dto: TriggerSosDto) {
    const ride = dto.ride_id ? await this.ridesService.findOne(user, dto.ride_id) : null;
    return this.safetyService.triggerSos(user.id, ride, dto.lat, dto.lng);
  }
}
