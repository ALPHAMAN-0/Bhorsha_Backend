import {
  Body,
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
import { PickupDto } from './dto/pickup.dto.js';

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

  @Post(':id/passengers/:pid/pickup')
  @HttpCode(HttpStatus.OK)
  pickup(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) rideId: number,
    @Param('pid', ParseIntPipe) passengerId: number,
    @Body() dto: PickupDto,
  ) {
    return this.driverRidesService.pickup(userId, rideId, passengerId, dto.pin);
  }

  @Post(':id/passengers/:pid/dropoff')
  @HttpCode(HttpStatus.OK)
  dropoff(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) rideId: number,
    @Param('pid', ParseIntPipe) passengerId: number,
  ) {
    return this.driverRidesService.dropoff(userId, rideId, passengerId);
  }
}