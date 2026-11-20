import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateRatingDto {
  @ApiProperty({ example: 1, description: 'Ride ID' })
  @IsInt()
  ride_id: number;

  @ApiProperty({
    example: 5,
    description: 'User ID of the person you rate (the driver, or another rider on the ride)',
  })
  @IsInt()
  ratee_id: number;

  @ApiProperty({
    example: 5,
    description: 'Stars, 1 to 5',
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  score: number;

  @ApiPropertyOptional({
    example: 'Polite driver, smooth ride, no overcharging.',
    description: 'Optional comment (up to 500 characters)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
