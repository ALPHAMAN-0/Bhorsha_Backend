import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ApiDriverDomain } from '../../common/decorators/api-driver-domain.decorator.js';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator.js';
import { DriversService } from './drivers.service.js';
import { UpdateLocationDto } from './dto/update-location.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';

@ApiDriverDomain()
@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @ApiOperation({ summary: 'Get my driver profile' })
  @Get('me')
  findMe(@CurrentUserId() userId: number) {
    return this.driversService.findMe(userId);
  }

  @ApiOperation({ summary: 'Go online or offline' })
  @Patch('me/status')
  updateStatus(
    @CurrentUserId() userId: number,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.driversService.updateStatus(userId, dto);
  }

  @ApiOperation({ summary: 'Update my current location' })
  @Put('me/location')
  updateLocation(
    @CurrentUserId() userId: number,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.driversService.updateLocation(userId, dto);
  }
}