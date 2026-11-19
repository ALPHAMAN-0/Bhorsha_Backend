import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator.js';
import { CreateRouteOfferDto } from './dto/create-route-offer.dto.js';
import { RouteOffersService } from './route-offers.service.js';

@ApiTags('Driver Domain')
@ApiHeader({
  name: 'x-user-id',
  description: 'Who is calling (user ID). Leave empty to see 401',
  required: false,
  example: '5',
})
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