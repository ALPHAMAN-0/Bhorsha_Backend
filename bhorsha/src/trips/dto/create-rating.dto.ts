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
    example: 'cf9bdb60-e143-4ec2-8868-2dc4289cb912',
    description: 'Ride UUID',
  })
  @IsString()
  ride_id: string;

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
