import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

/** Body of POST /rides/:id/sos: where the rider is now (the ride is in the URL). */
export class SosLocationDto {
  @ApiPropertyOptional({
    example: 23.8103,
    description: 'Current latitude for live police dispatch',
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({
    example: 90.4125,
    description: 'Current longitude for live police dispatch',
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}

/** Body of POST /sos: the location, and optionally a ride the sender is on. */
export class TriggerSosDto extends SosLocationDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Ride ID, if the SOS is about a ride you are on (leave out for a general SOS)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  ride_id?: number;
}
