import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import { REG_NO_MESSAGE, REG_NO_PATTERN } from './create-vehicle.dto.js';

export class UpdateVehicleDto {
  @ApiPropertyOptional({ example: 'DHAKA METRO-KHA 12-3456' })
  @IsOptional()
  @Matches(REG_NO_PATTERN, { message: REG_NO_MESSAGE })
  regNo?: string;
}