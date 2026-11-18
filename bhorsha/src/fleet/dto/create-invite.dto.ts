import { IsInt, Min } from 'class-validator';

export class CreateInviteDto {
  @IsInt({ message: 'waitingRideId must be a whole number' })
  @Min(1)
  waitingRideId: number;
}