import { IsEnum, IsOptional, Matches } from 'class-validator';
import { VehicleType } from '../vehicle-type.js';
import { REG_NO_PATTERN } from './create-vehicle.dto.js';

export class UpdateVehicleDto {
  @IsOptional()
  @IsEnum(VehicleType, { message: 'type must be BIKE, CAR or CNG' })
  type?: VehicleType;

  @IsOptional()
  @Matches(REG_NO_PATTERN, {
    message: 'regNo must look like DHAKA METRO-GA-12-3456',
  })
  regNo?: string;
}