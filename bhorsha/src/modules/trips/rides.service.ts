import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Page } from '../../common/dto/page.js';
import { type AuthUser, isStaff } from '../../common/guards/auth-user.js';
import { inTransaction, type Tx } from '../../common/transaction.js';
import { SEAT_CAPACITY, VehicleType } from '../fleet/vehicle-type.js';
import { Role } from '../identity/entities/user.entity.js';
import { PricingService } from '../pricing/pricing.service.js';
import { CreateRideDto } from './dto/create-ride.dto.js';
import { RideStatus } from './entities/ride.entity.js';
import {
  type PassengerRow,
  type RideRow,
  type RideView,
  LIVE_SEAT_STATUSES,
  newPickupPin,
  toRideView,
  tripMeters,
} from './trip-views.js';

const INSERT_RIDE_SQL = `
INSERT INTO rides (vehicle_type, is_shared, seats_total, seats_free)
VALUES ($1, $2, $3, $4)
RETURNING *`;

const INSERT_PASSENGER_SQL = `
INSERT INTO ride_passengers (ride_id, rider_id, join_request_id, seats,
                             pickup_lat, pickup_lng, drop_lat, drop_lng, distance_m,
                             locked_fare_paisa, ceiling_paisa, pricing_snapshot, pickup_pin)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)
RETURNING *`;

/** The rider's one live seat, if any (uq_ride_passengers_one_live_seat_per_rider). */
const FIND_LIVE_SEAT_SQL = `
SELECT p.id, p.ride_id AS "rideId", p.join_request_id AS "joinRequestId", r.status AS "rideStatus"
  FROM ride_passengers p
  JOIN rides r ON r.id = p.ride_id
 WHERE p.rider_id = $1 AND p.status IN ('CONFIRMED', 'PICKED_UP')`;

const CANCEL_SEAT_SQL = `
UPDATE ride_passengers SET status = 'CANCELLED', cancelled_at = now()
 WHERE id = $1 AND status = 'CONFIRMED'
RETURNING id`;

const CANCEL_RIDE_SQL = `
UPDATE rides SET status = 'CANCELLED', cancel_reason = $2, cancelled_at = now()
 WHERE id = $1 AND status NOT IN ('COMPLETED', 'CANCELLED')
RETURNING id`;

/** A rider's live seat (CONFIRMED or PICKED_UP) and the status of its ride. */
export interface LiveSeat {
  id: number;
  rideId: number;
  joinRequestId: number | null;
  rideStatus: string;
}

/** The ride a heading-home route offer starts when its first rider is accepted. */
export interface OfferRide {
  vehicleType: string;
  seats: number;
  driverId: number;
  vehicleId: number;
}

/** A new seat: the rider's stops and fare, locked in (a booking's own fare or a join request's quote). */
export interface NewSeat {
  rideId: number;
  riderId: number;
  joinRequestId: number | null;
  seats: number;
  pickupLat: number | string;
  pickupLng: number | string;
  dropLat: number | string;
  dropLng: number | string;
  distanceM: number;
  farePaisa: number;
  ceilingPaisa: number;
  pricingSnapshot: Record<string, unknown>;
}

/**
 * The rides and ride_passengers tables (trips owns them, doc/databaseSQL.md
 * section 1): the rider's bookings and cancels, and the steps of the seat
 * transaction that the sharing module runs through this service.
 */
@Injectable()
export class RidesService {
  constructor(
    private readonly pricingService: PricingService,
    private readonly dataSource: DataSource,
  ) {}

  async getQuote(
    vehicleType: VehicleType = VehicleType.CAR,
    distanceKm: number = 5.0,
    isShared: boolean = false,
  ) {
    return this.pricingService.calculateQuote(vehicleType, distanceKm, isShared);
  }

  // ---------------------------------------------------------------- rides

  /**
   * Books a ride: a REQUESTED ride plus the rider's own seat (stops, locked
   * fare, ceiling, snapshot, PIN), in one transaction. A rider holds one live
   * seat at a time; booking again replaces their own still-REQUESTED ride
   * (cancelled as NO_DRIVER_FOUND), while a ride already under way is a 409.
   */
  async createRide(user: AuthUser, dto: CreateRideDto): Promise<RideView> {
    if (user.role !== Role.RIDER) {
      throw new ForbiddenException('Only riders can book a ride');
    }
    const vehicleType = dto.vehicle_type ?? VehicleType.CAR;
    const isShared = dto.is_shared ?? false;
    const pickup = { lat: dto.origin_lat, lng: dto.origin_lng };
    const drop = { lat: dto.dest_lat, lng: dto.dest_lng };
    const distanceM = tripMeters(dto.distance_km, pickup, drop);
    if (distanceM <= 0) {
      throw new BadRequestException('Pickup and drop-off are the same place');
    }

    const price = await this.pricingService.priceTrip(vehicleType, distanceM, isShared);
    const seats = 1;
    const seatsTotal = SEAT_CAPACITY[vehicleType];
    const seatsFree = isShared ? seatsTotal - seats : 0;
    const snapshot = {
      ...price.snapshot,
      originLabel: dto.origin ?? null,
      destinationLabel: dto.destination ?? null,
    };

    return inTransaction(this.dataSource, async (tx) => {
      await this.releaseWaitingBooking(tx, user.id, 'NO_DRIVER_FOUND', true);
      const ride = (await tx.one<RideRow>(INSERT_RIDE_SQL, [
        vehicleType,
        isShared,
        seatsTotal,
        seatsFree,
      ]))!;
      const seat = await this.insertSeat(tx, {
        rideId: ride.id,
        riderId: user.id,
        joinRequestId: null,
        seats,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropLat: drop.lat,
        dropLng: drop.lng,
        distanceM,
        farePaisa: price.farePaisa,
        ceilingPaisa: price.ceilingPaisa,
        pricingSnapshot: snapshot,
      });
      return toRideView(ride, [seat], user);
    });
  }

  /** Rides the user booked, joined or drives, newest first. */
  async findMyRides(user: AuthUser, page = 1, limit = 10): Promise<Page<RideView>> {
    const where = `r.driver_id = $1
       OR EXISTS (SELECT 1 FROM ride_passengers p WHERE p.ride_id = r.id AND p.rider_id = $1)`;
    const rides: RideRow[] = await this.dataSource.query(
      `SELECT r.* FROM rides r WHERE ${where} ORDER BY r.id DESC LIMIT $2 OFFSET $3`,
      [user.id, limit, (page - 1) * limit],
    );
    const [{ total }] = await this.dataSource.query(
      `SELECT count(*)::int AS total FROM rides r WHERE ${where}`,
      [user.id],
    );
    return { data: await this.withPassengers(rides, user), meta: { page, limit, total } };
  }

  /** Every ride on the platform, newest first (Admin / Support). */
  async findAllRides(
    user: AuthUser,
    status: RideStatus | undefined,
    page = 1,
    limit = 20,
  ): Promise<Page<RideView>> {
    const rides: RideRow[] = await this.dataSource.query(
      `SELECT * FROM rides WHERE ($1::ride_status IS NULL OR status = $1)
        ORDER BY id DESC LIMIT $2 OFFSET $3`,
      [status ?? null, limit, (page - 1) * limit],
    );
    const [{ total }] = await this.dataSource.query(
      `SELECT count(*)::int AS total FROM rides WHERE ($1::ride_status IS NULL OR status = $1)`,
      [status ?? null],
    );
    return { data: await this.withPassengers(rides, user), meta: { page, limit, total } };
  }

  /** One ride, for the people on it (its riders and driver) and for staff. */
  async findOne(user: AuthUser, id: number): Promise<RideView> {
    const [ride]: RideRow[] = await this.dataSource.query('SELECT * FROM rides WHERE id = $1', [id]);
    if (!ride) {
      throw new NotFoundException(`Ride ${id} not found`);
    }
    const passengers = await this.passengersOf([ride.id]);
    const onRide = ride.driver_id === user.id || passengers.some((p) => p.rider_id === user.id);
    if (!onRide && !isStaff(user)) {
      throw new ForbiddenException('You are not on this ride');
    }
    return toRideView(ride, passengers, user);
  }

  /**
   * The driver cancels the whole ride (only before anyone is on board). A rider
   * cancels their own seat before pickup: on a shared ride the seat is freed for
   * others; when no live seat is left, the ride is cancelled (or completed, if
   * someone was already dropped off).
   */
  async cancelRide(user: AuthUser, id: number): Promise<RideView> {
    return inTransaction(this.dataSource, async (tx) => {
      const ride = await tx.one<RideRow>('SELECT * FROM rides WHERE id = $1 FOR UPDATE', [id]);
      if (!ride) {
        throw new NotFoundException(`Ride ${id} not found`);
      }
      const passengers = await tx.rows<PassengerRow>(
        'SELECT * FROM ride_passengers WHERE ride_id = $1 ORDER BY id FOR UPDATE',
        [id],
      );
      // Who may cancel is checked before the ride's state, so an outsider can't learn it.
      const isDriver = ride.driver_id === user.id;
      if (!isDriver && !passengers.some((p) => p.rider_id === user.id)) {
        throw new ForbiddenException('You are not on this ride');
      }
      if (ride.status === 'COMPLETED' || ride.status === 'CANCELLED') {
        throw new ConflictException(`This ride is already ${ride.status.toLowerCase()}`);
      }

      if (isDriver) {
        if (passengers.some((p) => p.status === 'PICKED_UP')) {
          throw new ConflictException('Drop off every passenger before cancelling the ride');
        }
        await tx.rows(
          `UPDATE ride_passengers SET status = 'CANCELLED', cancelled_at = now()
            WHERE ride_id = $1 AND status = 'CONFIRMED'`,
          [id],
        );
        await tx.rows(CANCEL_RIDE_SQL, [id, 'DRIVER_CANCELLED']);
      } else {
        await this.cancelOwnSeat(tx, ride, passengers, user.id);
      }
      return this.loadRide(tx, id, user);
    });
  }

  private async cancelOwnSeat(
    tx: Tx,
    ride: RideRow,
    passengers: PassengerRow[],
    riderId: number,
  ): Promise<void> {
    const mine = passengers.find(
      (p) => p.rider_id === riderId && LIVE_SEAT_STATUSES.includes(p.status),
    );
    if (!mine) {
      // cancelRide already checked that the rider has a seat on this ride.
      throw new ConflictException('Your seat on this ride is already closed');
    }
    if (mine.status === 'PICKED_UP') {
      throw new ConflictException('You are already on board: the driver ends your trip at drop-off');
    }
    await tx.rows(CANCEL_SEAT_SQL, [mine.id]);

    const othersLive = passengers.some(
      (p) => p.id !== mine.id && LIVE_SEAT_STATUSES.includes(p.status),
    );
    if (othersLive) {
      if (ride.is_shared) {
        await tx.rows('UPDATE rides SET seats_free = seats_free + $2 WHERE id = $1', [
          ride.id,
          mine.seats,
        ]);
      }
      return;
    }
    const someoneDropped = passengers.some((p) => p.status === 'DROPPED');
    if (someoneDropped && ride.status === 'IN_PROGRESS') {
      await tx.rows(
        `UPDATE rides SET status = 'COMPLETED', completed_at = now() WHERE id = $1`,
        [ride.id],
      );
    } else {
      await tx.rows(CANCEL_RIDE_SQL, [ride.id, 'RIDER_CANCELLED']);
    }
  }

  // ------------------------------------------------- seat transaction steps
  // The sharing module runs the seat transaction (doc/databaseSQL.md section 9)
  // and passes its Tx here, so rides and ride_passengers are written by their
  // owner in the same transaction.

  /** The rider's live seat, if any; inside a transaction when tx is given. */
  async findLiveSeat(riderId: number, tx?: Tx): Promise<LiveSeat | undefined> {
    if (tx) {
      return tx.one<LiveSeat>(FIND_LIVE_SEAT_SQL, [riderId]);
    }
    const [seat]: LiveSeat[] = await this.dataSource.query(FIND_LIVE_SEAT_SQL, [riderId]);
    return seat;
  }

  /** Step 1, heading home: the offer's driver starts an ACCEPTED shared ride with every offered seat free. */
  async startOfferRide(tx: Tx, offer: OfferRide): Promise<number> {
    const ride = (await tx.one<{ id: number }>(
      `INSERT INTO rides (vehicle_type, is_shared, seats_total, seats_free, status,
                          driver_id, vehicle_id, accepted_at)
       VALUES ($1, true, $2, $2, 'ACCEPTED', $3, $4, now())
       RETURNING id`,
      [offer.vehicleType, offer.seats, offer.driverId, offer.vehicleId],
    ))!;
    return ride.id;
  }

  /** Step 2: locks the rides in id order, the lock order every transaction uses. */
  async lockRides(tx: Tx, rideIds: number[]): Promise<RideRow[]> {
    return tx.rows<RideRow>('SELECT * FROM rides WHERE id = ANY($1) ORDER BY id FOR UPDATE', [
      rideIds,
    ]);
  }

  /**
   * Frees the rider for a new booking or seat (step 4 of the seat transaction,
   * and before a new booking). Only their own still-REQUESTED booking can be
   * released (seat first, then ride, because "one live seat per rider" is a
   * non-deferrable unique index). With failIfActive, a seat on a ride that is
   * already under way is a 409.
   */
  async releaseWaitingBooking(
    tx: Tx,
    riderId: number,
    reason: 'NO_DRIVER_FOUND' | 'JOINED_ANOTHER_RIDE',
    failIfActive: boolean,
  ): Promise<void> {
    const seat = await tx.one<LiveSeat>(FIND_LIVE_SEAT_SQL, [riderId]);
    if (!seat) {
      return;
    }
    const ownBooking = seat.joinRequestId === null;
    const ride = ownBooking
      ? await tx.one<RideRow>('SELECT * FROM rides WHERE id = $1 FOR UPDATE', [seat.rideId])
      : undefined;
    if (!ride || ride.status !== 'REQUESTED') {
      if (failIfActive) {
        throw new ConflictException(`You already have an active ride (ride ${seat.rideId})`);
      }
      return;
    }
    await tx.rows(CANCEL_SEAT_SQL, [seat.id]);
    await tx.rows(CANCEL_RIDE_SQL, [ride.id, reason]);
  }

  /**
   * Inserts a seat with its fare locked in and a new pickup PIN: a booking's own
   * seat, or step 5 of the seat transaction (the proposal becomes a seat).
   */
  async insertSeat(tx: Tx, seat: NewSeat): Promise<PassengerRow> {
    return (await tx.one<PassengerRow>(INSERT_PASSENGER_SQL, [
      seat.rideId,
      seat.riderId,
      seat.joinRequestId,
      seat.seats,
      seat.pickupLat,
      seat.pickupLng,
      seat.dropLat,
      seat.dropLng,
      seat.distanceM,
      seat.farePaisa,
      seat.ceilingPaisa,
      JSON.stringify(seat.pricingSnapshot),
      newPickupPin(),
    ]))!;
  }

  /** Step 6: takes the seats (ck_rides_seats_free backstops a race). */
  async takeSeats(tx: Tx, rideId: number, seats: number): Promise<void> {
    await tx.rows('UPDATE rides SET seats_free = seats_free - $2 WHERE id = $1', [rideId, seats]);
  }

  // ---------------------------------------------------------------- helpers

  private async passengersOf(rideIds: number[]): Promise<PassengerRow[]> {
    if (rideIds.length === 0) {
      return [];
    }
    return this.dataSource.query(
      'SELECT * FROM ride_passengers WHERE ride_id = ANY($1) ORDER BY id',
      [rideIds],
    );
  }

  private async withPassengers(rides: RideRow[], user: AuthUser): Promise<RideView[]> {
    const passengers = await this.passengersOf(rides.map((r) => r.id));
    return rides.map((ride) => toRideView(ride, passengers, user));
  }

  private async loadRide(tx: Tx, id: number, user: AuthUser): Promise<RideView> {
    const ride = (await tx.one<RideRow>('SELECT * FROM rides WHERE id = $1', [id]))!;
    const passengers = await tx.rows<PassengerRow>(
      'SELECT * FROM ride_passengers WHERE ride_id = $1 ORDER BY id',
      [id],
    );
    return toRideView(ride, passengers, user);
  }
}
