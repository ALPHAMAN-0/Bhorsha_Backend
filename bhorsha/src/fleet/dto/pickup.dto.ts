import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class PickupDto {
  @ApiProperty({ example: '4821' })
  @Matches(/^\d{4}$/, { message: 'pin must be 4 digits' })
  pin: string;
}