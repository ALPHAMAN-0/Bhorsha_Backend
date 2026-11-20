import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsPositive } from 'class-validator';
import { VehicleType } from '../../fleet/vehicle-type.js';

/** Query of GET /rides/quote. Every field is optional: by default a 5 km solo CAR trip. */
export class QuoteQueryDto {
  @ApiPropertyOptional({ enum: VehicleType, default: VehicleType.CAR })
  @IsOptional()
  @IsEnum(VehicleType, { message: 'vehicle_type must be BIKE, CAR or CNG' })
  vehicle_type: VehicleType = VehicleType.CAR;

  @ApiPropertyOptional({ type: Number, example: 5, default: 5, description: 'Trip distance in km' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'distance_km must be a number' })
  @IsPositive({ message: 'distance_km must be above 0' })
  distance_km: number = 5;

  @ApiPropertyOptional({
    type: Boolean,
    example: false,
    default: false,
    description: 'Share the ride with other riders (CAR or CNG only; a BIKE is never shared)',
  })
  @IsOptional()
  // true/1 and false/0 become booleans; anything else stays as sent, so @IsBoolean refuses it (400).
  @Transform(({ value }) =>
    value === 'true' || value === '1' ? true : value === 'false' || value === '0' ? false : value,
  )
  @IsBoolean({ message: 'is_shared must be true or false' })
  is_shared: boolean = false;
}
