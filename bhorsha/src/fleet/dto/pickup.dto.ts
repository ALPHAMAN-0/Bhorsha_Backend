import { Matches } from 'class-validator';

export class PickupDto {
  @Matches(/^\d{4}$/, { message: 'pin must be 4 digits' })
  pin: string;
}