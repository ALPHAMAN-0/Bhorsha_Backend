import { IsNumber, Max, Min } from 'class-validator';

export class UpdateLocationDto {
  @IsNumber({}, { message: 'lat must be a number' })
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber({}, { message: 'lng must be a number' })
  @Min(-180)
  @Max(180)
  lng: number;
}