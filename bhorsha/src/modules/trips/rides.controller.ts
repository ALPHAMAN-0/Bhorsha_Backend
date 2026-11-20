import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ApiPagination } from '../../common/dto/page.js';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import type { AuthUser } from '../../common/guards/auth-user.js';
import { Role } from '../identity/entities/user.entity.js';
import { CreateRideDto } from './dto/create-ride.dto.js';
import { FindRidesQueryDto } from './dto/find-rides-query.dto.js';
import { QuoteQueryDto } from './dto/quote-query.dto.js';
import { RidesService } from './rides.service.js';

/** The rider's rides: quote, book, list, view and cancel. */
@ApiTags('Rider Domain')
@Controller()
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Get('rides/quote')
  @ApiOperation({ summary: 'Calculate upfront fare quote with BRTA legal ceiling rules' })
  getQuote(@Query() query: QuoteQueryDto) {
    return this.ridesService.getQuote(query.vehicle_type, query.distance_km, query.is_shared);
  }

  @Post('rides')
  @ApiOperation({
    summary: 'Book a solo or shared ride (Rider)',
    description:
      'Creates a REQUESTED ride and your seat on it, with the fare locked in Tk and a 4-digit pickup PIN ' +
      'to tell the driver. Booking again replaces your own ride that no driver has accepted yet.',
  })
  @ApiHeader({ name: 'x-user-id', description: 'Rider User ID', required: true, example: '1' })
  createRide(@CurrentUser() user: AuthUser, @Body() dto: CreateRideDto) {
    return this.ridesService.createRide(user, dto);
  }

  @Get('rides/my')
  @ApiPagination()
  @ApiOperation({ summary: 'List my rides, newest first (as rider or driver)' })
  @ApiHeader({ name: 'x-user-id', description: 'User ID', required: true, example: '1' })
  findMyRides(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.ridesService.findMyRides(user, query.page, query.limit);
  }

  @Get('rides')
  @Roles(Role.ADMIN, Role.SUPPORT)
  @ApiPagination()
  @ApiOperation({ summary: 'List all platform rides (Support / Admin oversight)' })
  findAllRides(@CurrentUser() user: AuthUser, @Query() query: FindRidesQueryDto) {
    return this.ridesService.findAllRides(user, query.status, query.page, query.limit);
  }

  @Get('rides/:id')
  @ApiOperation({ summary: 'Get one ride (its riders, its driver, or Admin / Support)' })
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.ridesService.findOne(user, id);
  }

  @Post('rides/:id/cancel')
  @ApiOperation({
    summary: 'Cancel: a rider cancels their seat before pickup; the driver cancels the whole ride',
  })
  @ApiHeader({ name: 'x-user-id', description: 'Rider or Driver ID', required: true, example: '1' })
  cancelRide(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.ridesService.cancelRide(user, id);
  }

}
