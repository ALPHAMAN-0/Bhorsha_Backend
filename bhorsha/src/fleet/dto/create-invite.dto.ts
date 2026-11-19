import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class CreateInviteDto {
  @ApiProperty({ example: 12 })
  @IsInt({ message: 'waitingRideId must be a whole number' })
  @Min(1)
  waitingRideId: number;
}