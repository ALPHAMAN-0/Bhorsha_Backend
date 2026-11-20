import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { DriverAvailability } from '../entities/driver-profile.entity.js';

export class UpdateStatusDto {
  @ApiProperty({ enum: DriverAvailability, example: 'ONLINE' })
  @IsEnum(DriverAvailability, { message: 'status must be ONLINE or OFFLINE' })
  status: DriverAvailability;
}