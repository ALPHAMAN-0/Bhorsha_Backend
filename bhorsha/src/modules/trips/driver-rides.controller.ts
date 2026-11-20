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
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator.js';
import { DriverRidesService } from './driver-rides.service.js';
import { PickupDto } from './dto/pickup.dto.js';

@ApiTags('Driver Domain')
@ApiHeader({
  name: 'x-user-id',
  description: 'Who is calling (user ID). Leave empty to see 401',
  required: false,
  example: '5',
})
@Controller('rides')
export class DriverRidesController {
  constructor(private readonly driverRidesService: DriverRidesService) {}

  @ApiOperation({ summary: 'List open ride requests I can accept' })
  @Get('open')
  findOpen(@CurrentUserId() userId: number) {
    return this.driverRidesService.findOpen(userId);
  }

  @ApiOperation({ summary: 'Accept a ride request' })
  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) rideId: number,
  ) {
    return this.driverRidesService.accept(userId, rideId);
  }

  @ApiOperation({ summary: 'Tell the rider I have arrived' })
  @Post(':id/arrive')
  @HttpCode(HttpStatus.OK)
  arrive(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) rideId: number,
  ) {
    return this.driverRidesService.arrive(userId, rideId);
  }

  @ApiOperation({ summary: 'Pick up a passenger with their 4-digit PIN' })
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

  @ApiOperation({ summary: 'Drop off a passenger' })
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