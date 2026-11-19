import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, QueryResult, QueryRunner } from 'typeorm';
import type { Page } from '../common/dto/page.js';
import type { AuthUser } from '../common/guards/auth-user.js';
import { SEAT_CAPACITY, VehicleType } from '../fleet/vehicle-type.js';
import { PricingService } from '../pricing/pricing.service.js';
import { Role } from '../users/entities/user.entity.js';
import { CreateJoinRequestDto } from './dto/create-join-request.dto.js';
import { CreateRatingDto } from './dto/create-rating.dto.js';
import { CreateRideDto } from './dto/create-ride.dto.js';
import { RideStatus } from './entities/ride.entity.js';
import {
  type JoinRequestRow,
  type JoinRequestView,
  type PassengerRow,
  type PassengerView,
  type RideRow,
  type RideView,
  LIVE_SEAT_STATUSES,
  RUNNING_RIDE_STATUSES,
  isStaff,
  newPickupPin,
  straightLineMeters,
  toJoinRequestView,
  toPassengerView,
  toRideView,
  tripMeters,
} from './trip-views.js';

/** Rider join requests live 12 s by default (doc/databaseSQL.md section 9); raise it in .env for Swagger demos. */
const DEFAULT_REQUEST_TTL_SECONDS = 12;
const MAX_NEARBY_RESULTS = 20;

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

const NEARBY_SQL = `
SELECT 'RIDE' AS kind, r.id AS ride_id, NULL::int AS route_offer_id, r.driver_id,
       r.vehicle_type, r.seats_free AS seats_available, r.status::text AS status,
       dp.last_lat AS lat, dp.last_lng AS lng, NULL::timestamptz AS expires_at
  FROM rides r
  JOIN driver_profiles dp ON dp.user_id = r.driver_id
 WHERE r.is_shared AND r.status IN ('ACCEPTED', 'ARRIVED', 'IN_PROGRESS')
   AND r.seats_free > 0 AND dp.last_lat IS NOT NULL
UNION ALL
SELECT 'ROUTE_OFFER', NULL, o.id, o.driver_id,
       o.vehicle_type, o.seats_offered, o.status::text,
       o.from_lat, o.from_lng, o.expires_at
  FROM route_offers o
 WHERE o.status = 'OPEN' AND o.expires_at > now() AND o.ride_id IS NULL`;

interface LiveSeat {
  id: number;
  rideId: number;
  joinRequestId: number | null;
  rideStatus: string;
}

interface NearbyRow {
  kind: 'RIDE' | 'ROUTE_OFFER';
  ride_id: number | null;
  route_offer_id: number | null;
  driver_id: number;
  vehicle_type: string;
  seats_available: number;
  status: string;
  lat: string;
  lng: string;
  expires_at: Date | null;
}

interface RouteOfferRow {
  id: number;
  driver_id: number;
  ride_id: number | null;
  vehicle_id: number;
  vehicle_type: string;
  seats_offered: number;
  status: string;
  expired: boolean;
}

/** Runs SQL inside one transaction and always returns the rows. */
class Tx {
  constructor(private readonly runner: QueryRunner) {}

  async rows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result: QueryResult = await this.runner.query(sql, params, true);
    return result.records as T[];
  }

  async one<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return (await this.rows<T>(sql, params))[0];
  }
}

@Injectable()
export class TripsService {
  private readonly requestTtlSeconds: number;

  constructor(
    private readonly pricingService: PricingService,
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    const ttl = Number(config.get('RIDER_REQUEST_TTL_SECONDS', DEFAULT_REQUEST_TTL_SECONDS));
    this.requestTtlSeconds = Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULT_REQUEST_TTL_SECONDS;
  }

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

    return this.inTransaction(async (tx) => {
      await this.releaseWaitingBooking(tx, user.id, 'NO_DRIVER_FOUND', true);
      const ride = (await tx.one<RideRow>(INSERT_RIDE_SQL, [
        vehicleType,
        isShared,
        seatsTotal,
        seatsFree,
      ]))!;
      const seat = (await tx.one<PassengerRow>(INSERT_PASSENGER_SQL, [
        ride.id,
        user.id,
        null,
        seats,
        pickup.lat,
        pickup.lng,
        drop.lat,
        drop.lng,
        distanceM,
        price.farePaisa,
        price.ceilingPaisa,
        JSON.stringify(snapshot),
        newPickupPin(),
      ]))!;
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
    return this.inTransaction(async (tx) => {
      const ride = await tx.one<RideRow>('SELECT * FROM rides WHERE id = $1 FOR UPDATE', [id]);
      if (!ride) {
        throw new NotFoundException(`Ride ${id} not found`);
      }
      if (ride.status === 'COMPLETED' || ride.status === 'CANCELLED') {
        throw new ConflictException(`This ride is already ${ride.status.toLowerCase()}`);
      }
      const passengers = await tx.rows<PassengerRow>(
        'SELECT * FROM ride_passengers WHERE ride_id = $1 ORDER BY id FOR UPDATE',
        [id],
      );

      if (ride.driver_id === user.id) {
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
      if (passengers.some((p) => p.rider_id === riderId)) {
        throw new ConflictException('Your seat on this ride is already closed');
      }
      throw new ForbiddenException('You are not on this ride');
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

  // ---------------------------------------------------------------- sharing

  /**
   * Running shared rides with a free seat (located at their driver) and open
   * "going this way" route offers, nearest first, within radiusKm.
   */
  async getNearbyOffers(lat = 23.8103, lng = 90.4125, radiusKm = 5.0) {
    if (![lat, lng, radiusKm].every(Number.isFinite) || radiusKm <= 0) {
      throw new BadRequestException('lat, lng and radius_km must be numbers (radius above 0)');
    }
    const rows: NearbyRow[] = await this.dataSource.query(NEARBY_SQL);
    const here = { lat, lng };
    return rows
      .map((row) => ({
        kind: row.kind,
        ride_id: row.ride_id,
        route_offer_id: row.route_offer_id,
        driver_id: row.driver_id,
        vehicle_type: row.vehicle_type,
        seats_available: row.seats_available,
        status: row.status,
        distance_km:
          Math.round(straightLineMeters(here, { lat: Number(row.lat), lng: Number(row.lng) }) / 10) /
          100,
        expires_at: row.expires_at,
      }))
      .filter((item) => item.distance_km <= radiusKm)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, MAX_NEARBY_RESULTS);
  }

  /**
   * A rider asks to join a driver's running shared ride or open route offer.
   * The fare is quoted now (shared price, locked if accepted); the request
   * expires after RIDER_REQUEST_TTL_SECONDS.
   */
  async createJoinRequest(user: AuthUser, dto: CreateJoinRequestDto): Promise<JoinRequestView> {
    if (user.role !== Role.RIDER) {
      throw new ForbiddenException('Only riders can ask to join a ride');
    }
    if ((dto.ride_id === undefined) === (dto.route_offer_id === undefined)) {
      throw new BadRequestException('Send exactly one of ride_id or route_offer_id');
    }
    const seats = dto.seats ?? 1;
    const pickup = { lat: dto.pickup_lat, lng: dto.pickup_lng };
    const drop = { lat: dto.dropoff_lat, lng: dto.dropoff_lng };
    const distanceM = tripMeters(dto.distance_km, pickup, drop);
    if (distanceM <= 0) {
      throw new BadRequestException('Pickup and drop-off are the same place');
    }

    const target = dto.ride_id !== undefined
      ? await this.joinableRide(dto.ride_id)
      : await this.joinableOffer(dto.route_offer_id!);
    if (target.seatsFree < seats) {
      throw new ConflictException(`Seats left: ${target.seatsFree}`);
    }
    if (target.driverId === user.id) {
      throw new BadRequestException('You cannot join your own ride');
    }

    const [liveSeat]: LiveSeat[] = await this.dataSource.query(FIND_LIVE_SEAT_SQL, [user.id]);
    if (liveSeat && !(liveSeat.rideStatus === 'REQUESTED' && liveSeat.joinRequestId === null)) {
      throw new ConflictException(`You already have an active ride (ride ${liveSeat.rideId})`);
    }
    const [open] = await this.dataSource.query(
      `SELECT id FROM join_requests
        WHERE rider_id = $1 AND status = 'PENDING' AND expires_at > now()
          AND ride_id IS NOT DISTINCT FROM $2 AND route_offer_id IS NOT DISTINCT FROM $3`,
      [user.id, dto.ride_id ?? null, dto.route_offer_id ?? null],
    );
    if (open) {
      throw new ConflictException(`You already asked to join this (request ${open.id})`);
    }

    const price = await this.pricingService.priceTrip(
      target.vehicleType as VehicleType,
      distanceM,
      true,
    );
    const [row]: JoinRequestRow[] = await this.dataSource.query(
      `INSERT INTO join_requests (ride_id, route_offer_id, rider_id, driver_id, initiated_by, seats,
                                  pickup_lat, pickup_lng, drop_lat, drop_lng, distance_m,
                                  quoted_fare_paisa, ceiling_paisa, pricing_snapshot, expires_at)
       VALUES ($1, $2, $3, $4, 'RIDER', $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb,
               now() + make_interval(secs => $14))
       RETURNING *`,
      [
        dto.ride_id ?? null,
        dto.route_offer_id ?? null,
        user.id,
        target.driverId,
        seats,
        pickup.lat,
        pickup.lng,
        drop.lat,
        drop.lng,
        distanceM,
        price.farePaisa,
        price.ceilingPaisa,
        JSON.stringify(price.snapshot),
        this.requestTtlSeconds,
      ],
    );
    return toJoinRequestView(row);
  }

  /** Requests the user sent or received (as the rider or the driver), newest first. */
  async findMyJoinRequests(user: AuthUser): Promise<JoinRequestView[]> {
    const rows: JoinRequestRow[] = await this.dataSource.query(
      `SELECT * FROM join_requests WHERE rider_id = $1 OR driver_id = $1 ORDER BY id DESC LIMIT 50`,
      [user.id],
    );
    const now = new Date();
    return rows.map((row) => toJoinRequestView(row, now));
  }

  /**
   * The other side answers a join request: the driver answers a rider's
   * request, the rider answers a driver's invite. Accepting runs the seat
   * transaction from doc/databaseSQL.md section 9.
   */
  async respondJoinRequest(
    requestId: number,
    user: AuthUser,
    accept: boolean,
  ): Promise<JoinRequestView & { seat?: PassengerView }> {
    return this.inTransaction(async (tx) => {
      const request = await tx.one<JoinRequestRow & { expired: boolean }>(
        'SELECT *, expires_at <= now() AS expired FROM join_requests WHERE id = $1',
        [requestId],
      );
      if (!request) {
        throw new NotFoundException(`Join request ${requestId} not found`);
      }
      const answererId = request.initiated_by === 'RIDER' ? request.driver_id : request.rider_id;
      if (user.id !== answererId) {
        throw new ForbiddenException(
          request.initiated_by === 'RIDER'
            ? 'Only the driver can answer this request'
            : 'Only the invited rider can answer this invite',
        );
      }
      if (request.status !== 'PENDING') {
        throw new ConflictException(`This request was already ${request.status.toLowerCase()}`);
      }
      if (request.expired) {
        throw new ConflictException('This request has expired');
      }

      if (!accept) {
        const declined = await this.closeRequest(tx, requestId, 'DECLINED');
        return toJoinRequestView(declined);
      }

      // 1. A route offer is locked first; heading home with no ride yet starts one now.
      const targetRideId = request.route_offer_id !== null
        ? await this.rideForOffer(tx, request.route_offer_id)
        : request.ride_id!;

      // 2. Lock the target ride and, if the rider is waiting on their own booking, that ride too.
      const [liveSeat] = await tx.rows<LiveSeat>(FIND_LIVE_SEAT_SQL, [request.rider_id]);
      const waiting = liveSeat?.rideStatus === 'REQUESTED' && liveSeat.joinRequestId === null;
      if (liveSeat && !waiting) {
        throw new ConflictException('This rider already has an active ride');
      }
      const lockIds = waiting ? [targetRideId, liveSeat.rideId] : [targetRideId];
      const locked = await tx.rows<RideRow>(
        'SELECT * FROM rides WHERE id = ANY($1) ORDER BY id FOR UPDATE',
        [lockIds],
      );
      const target = locked.find((r) => r.id === targetRideId);

      // 3. The target must be a running shared ride with room.
      if (
        !target ||
        !target.is_shared ||
        !RUNNING_RIDE_STATUSES.includes(target.status) ||
        target.seats_free < request.seats
      ) {
        throw new ConflictException('Seat no longer available');
      }

      // 4. Cancel the rider's waiting booking: their seat first, then their ride.
      if (waiting) {
        await this.releaseWaitingBooking(tx, request.rider_id, 'JOINED_ANOTHER_RIDE', false);
      }

      // 5. The proposal becomes a seat with the quoted fare locked in.
      const seat = (await tx.one<PassengerRow>(INSERT_PASSENGER_SQL, [
        targetRideId,
        request.rider_id,
        request.id,
        request.seats,
        request.pickup_lat,
        request.pickup_lng,
        request.drop_lat,
        request.drop_lng,
        request.distance_m,
        request.quoted_fare_paisa,
        request.ceiling_paisa,
        JSON.stringify(request.pricing_snapshot),
        newPickupPin(),
      ]))!;

      // 6. Take the seats (ck_rides_seats_free backstops a race).
      await tx.rows('UPDATE rides SET seats_free = seats_free - $2 WHERE id = $1', [
        targetRideId,
        request.seats,
      ]);

      // 7. Mark the request accepted; 0 rows means it was answered or expired meanwhile.
      const accepted = await this.closeRequest(tx, requestId, 'ACCEPTED');
      return { ...toJoinRequestView(accepted), seat: toPassengerView(seat, target, user) };
    });
  }

  // ---------------------------------------------------------------- ratings

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

  // ---------------------------------------------------------------- helpers

  private async inTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const result = await work(new Tx(runner));
      await runner.commitTransaction();
      return result;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  /**
   * Frees the rider for a new booking or seat. Only their own still-REQUESTED
   * booking can be released (seat first, then ride, because "one live seat per
   * rider" is a non-deferrable unique index). With failIfActive, a seat on a ride
   * that is already under way is a 409.
   */
  private async releaseWaitingBooking(
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

  /** Locks the offer; returns its ride, starting one (ACCEPTED, shared) when the driver has none yet. */
  private async rideForOffer(tx: Tx, offerId: number): Promise<number> {
    const offer = await tx.one<RouteOfferRow>(
      'SELECT *, expires_at <= now() AS expired FROM route_offers WHERE id = $1 FOR UPDATE',
      [offerId],
    );
    if (!offer || offer.status !== 'OPEN' || offer.expired) {
      throw new ConflictException('This route offer is closed');
    }
    if (offer.ride_id !== null) {
      return offer.ride_id;
    }
    const ride = (await tx.one<{ id: number }>(
      `INSERT INTO rides (vehicle_type, is_shared, seats_total, seats_free, status,
                          driver_id, vehicle_id, accepted_at)
       VALUES ($1, true, $2, $2, 'ACCEPTED', $3, $4, now())
       RETURNING id`,
      [offer.vehicle_type, offer.seats_offered, offer.driver_id, offer.vehicle_id],
    ))!;
    await tx.rows('UPDATE route_offers SET ride_id = $2 WHERE id = $1', [offerId, ride.id]);
    return ride.id;
  }

  private async closeRequest(
    tx: Tx,
    requestId: number,
    status: 'ACCEPTED' | 'DECLINED',
  ): Promise<JoinRequestRow> {
    const row = await tx.one<JoinRequestRow>(
      `UPDATE join_requests SET status = $2, decided_at = now()
        WHERE id = $1 AND status = 'PENDING' AND expires_at > now()
       RETURNING *`,
      [requestId, status],
    );
    if (!row) {
      throw new ConflictException('This request was already answered or has expired');
    }
    return row;
  }

  private async joinableRide(rideId: number) {
    const [ride]: RideRow[] = await this.dataSource.query('SELECT * FROM rides WHERE id = $1', [
      rideId,
    ]);
    if (!ride) {
      throw new NotFoundException(`Ride ${rideId} not found`);
    }
    if (!ride.is_shared || !RUNNING_RIDE_STATUSES.includes(ride.status) || ride.driver_id === null) {
      throw new ConflictException("This ride is not a driver's running shared ride");
    }
    return { driverId: ride.driver_id, vehicleType: ride.vehicle_type, seatsFree: ride.seats_free };
  }

  private async joinableOffer(offerId: number) {
    const [offer]: (RouteOfferRow & { ride_seats_free: number | null })[] =
      await this.dataSource.query(
        `SELECT o.*, o.expires_at <= now() AS expired, r.seats_free AS ride_seats_free
           FROM route_offers o LEFT JOIN rides r ON r.id = o.ride_id
          WHERE o.id = $1`,
        [offerId],
      );
    if (!offer) {
      throw new NotFoundException(`Route offer ${offerId} not found`);
    }
    if (offer.status !== 'OPEN' || offer.expired) {
      throw new ConflictException('This route offer is closed');
    }
    return {
      driverId: offer.driver_id,
      vehicleType: offer.vehicle_type,
      seatsFree: offer.ride_seats_free ?? offer.seats_offered,
    };
  }

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
