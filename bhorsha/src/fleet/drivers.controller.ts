import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator.js';
import { DriversService } from './drivers.service.js';
import { UpdateLocationDto } from './dto/update-location.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';

@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get('me')
  findMe(@CurrentUserId() userId: number) {
    return this.driversService.findMe(userId);
  }

  @Patch('me/status')
  updateStatus(
    @CurrentUserId() userId: number,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.driversService.updateStatus(userId, dto);
  }

  @Put('me/location')
  updateLocation(
    @CurrentUserId() userId: number,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.driversService.updateLocation(userId, dto);
  }
}