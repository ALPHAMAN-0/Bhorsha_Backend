import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { VehicleType } from '../../fleet/vehicle-type.js';

export class CreateRideDto {
  @ApiPropertyOptional({
    example: 'Dhanmondi 27',
    description: 'Pickup place name, shown on the ride (optional)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  origin?: string;

  @ApiPropertyOptional({
    example: 'Gulshan 1',
    description: 'Drop-off place name, shown on the ride (optional)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  destination?: string;

  @ApiPropertyOptional({
    example: 8.5,
    description:
      'Route distance in km (min 0.5). Leave it out to use the straight-line distance between the two points.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  distance_km?: number;

  @ApiPropertyOptional({
    enum: VehicleType,
    example: VehicleType.CAR,
    description: 'Type of vehicle: CAR, BIKE, or CNG',
    default: VehicleType.CAR,
  })
  @IsOptional()
  @IsEnum(VehicleType)
  vehicle_type?: VehicleType = VehicleType.CAR;

  @ApiPropertyOptional({
    example: false,
    description: 'True for seat-sharing (carpool, CAR or CNG only; a BIKE is never shared), False for solo ride',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_shared?: boolean = false;

  @ApiProperty({ example: 23.7465, description: 'Pickup latitude' })
  @IsLatitude()
  origin_lat: number;

  @ApiProperty({ example: 90.376, description: 'Pickup longitude' })
  @IsLongitude()
  origin_lng: number;

  @ApiProperty({ example: 23.7782, description: 'Drop-off latitude' })
  @IsLatitude()
  dest_lat: number;

  @ApiProperty({ example: 90.4182, description: 'Drop-off longitude' })
  @IsLongitude()
  dest_lng: number;
}
