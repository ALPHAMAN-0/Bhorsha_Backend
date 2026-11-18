import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class CreateRouteOfferDto {
  @IsInt({ message: 'vehicleId must be a whole number' })
  @Min(1)
  vehicleId: number;

  @IsNumber({}, { message: 'fromLat must be a number' })
  @Min(-90)
  @Max(90)
  fromLat: number;

  @IsNumber({}, { message: 'fromLng must be a number' })
  @Min(-180)
  @Max(180)
  fromLng: number;

  @IsNumber({}, { message: 'toLat must be a number' })
  @Min(-90)
  @Max(90)
  toLat: number;

  @IsNumber({}, { message: 'toLng must be a number' })
  @Min(-180)
  @Max(180)
  toLng: number;

  @IsInt({ message: 'seatsOffered must be a whole number' })
  @Min(1)
  @Max(3)
  seatsOffered: number;

  @IsOptional()
  @IsInt({ message: 'validForMinutes must be a whole number' })
  @Min(10)
  @Max(240)
  validForMinutes?: number;
}