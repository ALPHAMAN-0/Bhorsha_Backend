import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator.js';
import { CreateRouteOfferDto } from './dto/create-route-offer.dto.js';
import { RouteOffersService } from './route-offers.service.js';

@Controller('route-offers')
export class RouteOffersController {
  constructor(private readonly routeOffersService: RouteOffersService) {}

  @Post()
  create(@CurrentUserId() userId: number, @Body() dto: CreateRouteOfferDto) {
    return this.routeOffersService.create(userId, dto);
  }

  @Delete(':id')
  withdraw(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.routeOffersService.withdraw(userId, id);
  }
}