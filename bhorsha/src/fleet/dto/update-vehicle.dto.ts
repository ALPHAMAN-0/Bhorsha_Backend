import { IsOptional, Matches } from 'class-validator';
import { REG_NO_MESSAGE, REG_NO_PATTERN } from './create-vehicle.dto.js';

export class UpdateVehicleDto {
  @IsOptional()
  @Matches(REG_NO_PATTERN, { message: REG_NO_MESSAGE })
  regNo?: string;
}