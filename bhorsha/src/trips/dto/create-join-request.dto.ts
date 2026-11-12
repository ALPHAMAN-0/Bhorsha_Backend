import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateJoinRequestDto {
  @ApiProperty({
    example: 'cf9bdb60-e143-4ec2-8868-2dc4289cb912',
    description: 'Target Ride UUID to join',
  })
  @IsString()
  ride_id: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Number of seats requested (1 to 3)',
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  seats?: number = 1;

  @ApiPropertyOptional({ example: 23.7925, description: 'Pickup latitude' })
  @IsOptional()
  @IsNumber()
  pickup_lat?: number;

  @ApiPropertyOptional({ example: 90.4078, description: 'Pickup longitude' })
  @IsOptional()
  @IsNumber()
  pickup_lng?: number;

  @ApiPropertyOptional({ example: 23.7915, description: 'Dropoff latitude' })
  @IsOptional()
  @IsNumber()
  dropoff_lat?: number;

  @ApiPropertyOptional({ example: 90.415, description: 'Dropoff longitude' })
  @IsOptional()
  @IsNumber()
  dropoff_lng?: number;
}
