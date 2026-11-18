import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, Matches } from 'class-validator';
import { VehicleType } from '../vehicle-type.js';

export const REG_NO_PATTERN = /^[A-Z ]+-[A-Z]{1,3} \d{2}-\d{4}$/;
export const REG_NO_MESSAGE = 'regNo must look like DHAKA METRO-GA 11-2345';

export class CreateVehicleDto {
  @ApiProperty({ enum: VehicleType, example: 'CAR' })
  @IsEnum(VehicleType, { message: 'type must be BIKE, CAR or CNG' })
  type: VehicleType;

  @ApiProperty({ example: 'DHAKA METRO-GA 11-2345' })
  @Matches(REG_NO_PATTERN, { message: REG_NO_MESSAGE })
  regNo: string;
}