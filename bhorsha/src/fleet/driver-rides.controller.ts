import { Controller, Get } from '@nestjs/common';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator.js';
import { DriverRidesService } from './driver-rides.service.js';

@Controller('rides')
export class DriverRidesController {
  constructor(private readonly driverRidesService: DriverRidesService) {}

  @Get('open')
  findOpen(@CurrentUserId() userId: number) {
    return this.driverRidesService.findOpen(userId);
  }
}