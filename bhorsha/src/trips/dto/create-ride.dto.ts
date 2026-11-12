import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { VehicleType } from '../../fleet/vehicle-type.js';

export class CreateRideDto {
  @ApiProperty({
    example: 'Dhanmondi 27',
    description: 'Pickup location name or address',
  })
  @IsString()
  origin: string;

  @ApiProperty({
    example: 'Gulshan 1',
    description: 'Dropoff destination name or address',
  })
  @IsString()
  destination: string;

  @ApiPropertyOptional({
    example: 8.5,
    description: 'Estimated route distance in kilometers (min 0.5 km)',
    default: 5.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  distance_km?: number = 5.0;

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
    description: 'True for seat-sharing (carpool), False for solo ride',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_shared?: boolean = false;

  @ApiPropertyOptional({
    example: 23.7465,
    description: 'Pickup latitude coordinate (Dhaka)',
  })
  @IsOptional()
  @IsNumber()
  origin_lat?: number;

  @ApiPropertyOptional({
    example: 90.376,
    description: 'Pickup longitude coordinate (Dhaka)',
  })
  @IsOptional()
  @IsNumber()
  origin_lng?: number;

  @ApiPropertyOptional({
    example: 23.7782,
    description: 'Dropoff latitude coordinate (Dhaka)',
  })
  @IsOptional()
  @IsNumber()
  dest_lat?: number;

  @ApiPropertyOptional({
    example: 90.4182,
    description: 'Dropoff longitude coordinate (Dhaka)',
  })
  @IsOptional()
  @IsNumber()
  dest_lng?: number;
}
