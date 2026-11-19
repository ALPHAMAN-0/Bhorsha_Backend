import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator.js';
import { DriversService } from './drivers.service.js';
import { UpdateLocationDto } from './dto/update-location.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';

@ApiTags('Driver Domain')
@ApiHeader({
  name: 'x-user-id',
  description: 'Who is calling (user ID). Leave empty to see 401',
  required: false,
  example: '5',
})
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