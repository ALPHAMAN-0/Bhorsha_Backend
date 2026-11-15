import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator.js';
import { DriverRidesService } from './driver-rides.service.js';

@Controller('rides')
export class DriverRidesController {
  constructor(private readonly driverRidesService: DriverRidesService) {}

  @Get('open')
  findOpen(@CurrentUserId() userId: number) {
    return this.driverRidesService.findOpen(userId);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) rideId: number,
  ) {
    return this.driverRidesService.accept(userId, rideId);
  }

  @Post(':id/arrive')
  @HttpCode(HttpStatus.OK)
  arrive(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) rideId: number,
  ) {
    return this.driverRidesService.arrive(userId, rideId);
  }
}