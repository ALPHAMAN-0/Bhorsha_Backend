import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';

export class UpdateLocationDto {
  @ApiProperty({ example: 23.7806 })
  @IsNumber({}, { message: 'lat must be a number' })
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: 90.407 })
  @IsNumber({}, { message: 'lng must be a number' })
  @Min(-180)
  @Max(180)
  lng: number;
}