import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class CreateRouteOfferDto {
  @ApiProperty({ example: 1 })
  @IsInt({ message: 'vehicleId must be a whole number' })
  @Min(1)
  vehicleId: number;

  @ApiProperty({ example: 23.7806 })
  @IsNumber({}, { message: 'fromLat must be a number' })
  @Min(-90)
  @Max(90)
  fromLat: number;

  @ApiProperty({ example: 90.407 })
  @IsNumber({}, { message: 'fromLng must be a number' })
  @Min(-180)
  @Max(180)
  fromLng: number;

  @ApiProperty({ example: 23.8103 })
  @IsNumber({}, { message: 'toLat must be a number' })
  @Min(-90)
  @Max(90)
  toLat: number;

  @ApiProperty({ example: 90.4125 })
  @IsNumber({}, { message: 'toLng must be a number' })
  @Min(-180)
  @Max(180)
  toLng: number;

  @ApiProperty({ example: 2, minimum: 1, maximum: 3 })
  @IsInt({ message: 'seatsOffered must be a whole number' })
  @Min(1)
  @Max(3)
  seatsOffered: number;

  @ApiPropertyOptional({ example: 60, minimum: 10, maximum: 240 })
  @IsOptional()
  @IsInt({ message: 'validForMinutes must be a whole number' })
  @Min(10)
  @Max(240)
  validForMinutes?: number;
}