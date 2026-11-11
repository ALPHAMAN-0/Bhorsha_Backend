import { IsEnum, Matches } from 'class-validator';
import { VehicleType } from '../vehicle-type.js';

export const REG_NO_PATTERN = /^[A-Z ]+-[A-Z]{1,3}-\d{2}-\d{4}$/;

export class CreateVehicleDto {
  @IsEnum(VehicleType, { message: 'type must be BIKE, CAR or CNG' })
  type: VehicleType;

  @Matches(REG_NO_PATTERN, {
    message: 'regNo must look like DHAKA METRO-GA-12-3456',
  })
  regNo: string;
}