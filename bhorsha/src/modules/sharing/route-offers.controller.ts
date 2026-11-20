import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ApiDriverDomain } from '../../common/decorators/api-driver-domain.decorator.js';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator.js';
import { CreateRouteOfferDto } from './dto/create-route-offer.dto.js';
import { RouteOffersService } from './route-offers.service.js';

@ApiDriverDomain()
@Controller('route-offers')
export class RouteOffersController {
  constructor(private readonly routeOffersService: RouteOffersService) {}

  @ApiOperation({ summary: 'Publish a route offer with free seats' })
  @Post()
  create(@CurrentUserId() userId: number, @Body() dto: CreateRouteOfferDto) {
    return this.routeOffersService.create(userId, dto);
  }

  @ApiOperation({ summary: 'Withdraw my route offer' })
  @Delete(':id')
  withdraw(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.routeOffersService.withdraw(userId, id);
  }
}