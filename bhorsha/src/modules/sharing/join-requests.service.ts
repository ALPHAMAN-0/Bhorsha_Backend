import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { AuthUser } from '../../common/guards/auth-user.js';
import { inTransaction, type Tx } from '../../common/transaction.js';
import { VehicleType } from '../fleet/vehicle-type.js';
import { Role } from '../identity/entities/user.entity.js';
import { PricingService } from '../pricing/pricing.service.js';
import { RidesService } from '../trips/rides.service.js';
import {
  type PassengerView,
  type RideRow,
  RUNNING_RIDE_STATUSES,
  straightLineMeters,
  toPassengerView,
  tripMeters,
} from '../trips/trip-views.js';
import { CreateJoinRequestDto } from './dto/create-join-request.dto.js';
import {
  type JoinRequestRow,
  type JoinRequestView,
  toJoinRequestView,
} from './join-request-views.js';

/** Rider join requests live 12 s by default (doc/databaseSQL.md section 9); raise it in .env for Swagger demos. */
const DEFAULT_REQUEST_TTL_SECONDS = 12;
const MAX_NEARBY_RESULTS = 20;

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

/**
 * The rider's side of sharing: find a shared ride or route offer nearby, ask to
 * join it, and answer a request or an invite. Accepting runs the seat
 * transaction: this module writes route_offers and join_requests, and trips
 * writes rides and ride_passengers through RidesService, in the same transaction.
 */
@Injectable()
export class JoinRequestsService {
  private readonly requestTtlSeconds: number;

  constructor(
    private readonly ridesService: RidesService,
    private readonly pricingService: PricingService,
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    const ttl = Number(config.get('RIDER_REQUEST_TTL_SECONDS', DEFAULT_REQUEST_TTL_SECONDS));
    this.requestTtlSeconds = Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULT_REQUEST_TTL_SECONDS;
  }

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

    const liveSeat = await this.ridesService.findLiveSeat(user.id);
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
    return inTransaction(this.dataSource, async (tx) => {
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
      const liveSeat = await this.ridesService.findLiveSeat(request.rider_id, tx);
      const waiting = liveSeat?.rideStatus === 'REQUESTED' && liveSeat.joinRequestId === null;
      if (liveSeat && !waiting) {
        throw new ConflictException('This rider already has an active ride');
      }
      const lockIds = waiting ? [targetRideId, liveSeat.rideId] : [targetRideId];
      const locked = await this.ridesService.lockRides(tx, lockIds);
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
        await this.ridesService.releaseWaitingBooking(tx, request.rider_id, 'JOINED_ANOTHER_RIDE', false);
      }

      // 5. The proposal becomes a seat with the quoted fare locked in.
      const seat = await this.ridesService.insertSeat(tx, {
        rideId: targetRideId,
        riderId: request.rider_id,
        joinRequestId: request.id,
        seats: request.seats,
        pickupLat: request.pickup_lat,
        pickupLng: request.pickup_lng,
        dropLat: request.drop_lat,
        dropLng: request.drop_lng,
        distanceM: request.distance_m,
        farePaisa: request.quoted_fare_paisa,
        ceilingPaisa: request.ceiling_paisa,
        pricingSnapshot: request.pricing_snapshot,
      });

      // 6. Take the seats (ck_rides_seats_free backstops a race).
      await this.ridesService.takeSeats(tx, targetRideId, request.seats);

      // 7. Mark the request accepted; 0 rows means it was answered or expired meanwhile.
      const accepted = await this.closeRequest(tx, requestId, 'ACCEPTED');
      return { ...toJoinRequestView(accepted), seat: toPassengerView(seat, target, user) };
    });
  }

  // ---------------------------------------------------------------- helpers

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
    const rideId = await this.ridesService.startOfferRide(tx, {
      vehicleType: offer.vehicle_type,
      seats: offer.seats_offered,
      driverId: offer.driver_id,
      vehicleId: offer.vehicle_id,
    });
    await tx.rows('UPDATE route_offers SET ride_id = $2 WHERE id = $1', [offerId, rideId]);
    return rideId;
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
}
