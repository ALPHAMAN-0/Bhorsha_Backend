import { Body, Controller, Post } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/guards/auth-user.js';
import { CreateRatingDto } from './dto/create-rating.dto.js';
import { RatingsService } from './ratings.service.js';

@ApiTags('Rider Domain')
@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
  @ApiOperation({ summary: 'Rate the driver or a co-rider (1-5 stars) after the trip' })
  @ApiHeader({ name: 'x-user-id', description: 'Rater User ID', required: false, example: '3' })
  createRating(@CurrentUser() user: AuthUser, @Body() dto: CreateRatingDto) {
    return this.ratingsService.rateRide(user, dto);
  }
}
