import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateRatingDto {
  @ApiProperty({
    example: 5,
    description: 'Ride ID',
  })
  @IsInt()
  ride_id: number;

  @ApiProperty({
    example: 2,
    description: 'User ID of person being rated (e.g. driver userId 2)',
  })
  @IsInt()
  ratee_id: number;

  @ApiProperty({
    example: 5,
    description: 'Rating score between 1 and 5',
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  score: number;

  @ApiPropertyOptional({
    example: 'Polite driver, smooth ride, no overcharging.',
    description: 'Optional review comments',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
