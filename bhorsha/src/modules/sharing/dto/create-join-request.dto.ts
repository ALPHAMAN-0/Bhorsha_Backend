import { ApiProperty, ApiPropertyOptional, type ExamplesObject } from '@nestjs/swagger';
import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

const TRIP = { pickup_lat: 23.8175, pickup_lng: 90.4205, dropoff_lat: 23.7915, dropoff_lng: 90.415 };

/**
 * Swagger examples for POST /join-requests, one per target. Without them Swagger UI sends both
 * ride_id and route_offer_id, which is always refused (400).
 */
export const JOIN_REQUEST_EXAMPLES: ExamplesObject = {
  routeOffer: { summary: "Join a driver's route offer", value: { route_offer_id: 2, ...TRIP } },
  sharedRide: { summary: "Join a driver's running shared ride", value: { ride_id: 4, seats: 1, ...TRIP } },
};

/** Send exactly one of ride_id (a driver's running shared ride) or route_offer_id (a driver's "going this way" offer). */
export class CreateJoinRequestDto {
  @ApiPropertyOptional({
    example: 4,
    description: "A driver's running shared ride to join (from GET /route-offers/nearby, kind RIDE)",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  ride_id?: number;

  @ApiPropertyOptional({
    example: 2,
    description: "A driver's open route offer to join (from GET /route-offers/nearby, kind ROUTE_OFFER)",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  route_offer_id?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Seats requested on a shared ride (1 or 2)',
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2)
  seats?: number = 1;

  @ApiProperty({ example: 23.8175, description: 'Pickup latitude' })
  @IsLatitude()
  pickup_lat: number;

  @ApiProperty({ example: 90.4205, description: 'Pickup longitude' })
  @IsLongitude()
  pickup_lng: number;

  @ApiProperty({ example: 23.7915, description: 'Drop-off latitude' })
  @IsLatitude()
  dropoff_lat: number;

  @ApiProperty({ example: 90.415, description: 'Drop-off longitude' })
  @IsLongitude()
  dropoff_lng: number;

  @ApiPropertyOptional({
    example: 3.2,
    description: 'Your route distance in km. Leave it out to use the straight-line distance.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  distance_km?: number;
}
