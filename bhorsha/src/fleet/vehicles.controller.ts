import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { CreateVehicleDto } from './dto/create-vehicle.dto.js';
import { UpdateVehicleDto } from './dto/update-vehicle.dto.js';
import { VehiclesService } from './vehicles.service.js';

@ApiTags('Driver Domain')
@ApiHeader({
  name: 'x-user-id',
  description: 'Who is calling (user ID). Leave empty to see 401',
  required: false,
  example: '5',
})
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @ApiOperation({ summary: 'Add a vehicle (bike, car or CNG)' })
  @Post()
  create(@CurrentUserId() userId: number, @Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(userId, dto);
  }

  @ApiOperation({ summary: 'List my vehicles' })
  @Get('my')
  findMine(
    @CurrentUserId() userId: number,
    @Query() query: PaginationQueryDto,
  ) {
    return this.vehiclesService.findMine(userId, query);
  }

  @ApiOperation({ summary: 'Get one of my vehicles' })
  @Get(':id')
  findOne(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.vehiclesService.findOne(userId, id);
  }

  @ApiOperation({ summary: 'Change the registration number of a vehicle' })
  @Patch(':id')
  update(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.vehiclesService.update(userId, id, dto);
  }

  @ApiOperation({ summary: 'Remove a vehicle (soft delete)' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.vehiclesService.remove(userId, id);
  }
}