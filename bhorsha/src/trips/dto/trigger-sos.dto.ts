import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class TriggerSosDto {
  @ApiPropertyOptional({
    example: 'cf9bdb60-e143-4ec2-8868-2dc4289cb912',
    description: 'Ride UUID (optional if triggering general emergency)',
  })
  @IsOptional()
  @IsString()
  ride_id?: string;

  @ApiPropertyOptional({
    example: 23.8103,
    description: 'Current latitude for live police dispatch',
  })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({
    example: 90.4125,
    description: 'Current longitude for live police dispatch',
  })
  @IsOptional()
  @IsNumber()
  lng?: number;
}
