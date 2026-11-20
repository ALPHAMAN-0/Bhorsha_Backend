import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AuthUser } from '../../common/guards/auth-user.js';
import { CreateRatingDto } from './dto/create-rating.dto.js';
import type { RideRow } from './trip-views.js';

@Injectable()
export class RatingsService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Rate someone you rode with (the driver or another rider), after your part
   * of the trip is over. One rating per direction per ride.
   */
  async rateRide(user: AuthUser, dto: CreateRatingDto) {
    if (dto.ratee_id === user.id) {
      throw new BadRequestException('You cannot rate yourself');
    }
    const [ride]: RideRow[] = await this.dataSource.query('SELECT * FROM rides WHERE id = $1', [
      dto.ride_id,
    ]);
    if (!ride) {
      throw new NotFoundException(`Ride ${dto.ride_id} not found`);
    }
    const seats: { rider_id: number; status: string }[] = await this.dataSource.query(
      `SELECT rider_id, status FROM ride_passengers
        WHERE ride_id = $1 AND status IN ('PICKED_UP', 'DROPPED')`,
      [ride.id],
    );
    const seatOf = (id: number) => seats.find((s) => s.rider_id === id);
    const rode = (id: number) => id === ride.driver_id || seatOf(id) !== undefined;

    if (!rode(user.id)) {
      throw new ForbiddenException('Only people who took this ride can rate it');
    }
    if (!rode(dto.ratee_id)) {
      throw new BadRequestException(`User ${dto.ratee_id} did not take this ride`);
    }
    const finishedSeat = user.id === ride.driver_id ? seatOf(dto.ratee_id) : seatOf(user.id);
    const tripOver =
      ride.status === 'COMPLETED' || (finishedSeat !== undefined && finishedSeat.status === 'DROPPED');
    if (!tripOver) {
      throw new ConflictException('You can rate after the trip ends');
    }

    const [rating] = await this.dataSource.query(
      `INSERT INTO ratings (ride_id, from_user_id, to_user_id, stars, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, ride_id, from_user_id, to_user_id, stars, comment, created_at`,
      [ride.id, user.id, dto.ratee_id, dto.score, dto.comment ?? null],
    );
    return rating;
  }
}
