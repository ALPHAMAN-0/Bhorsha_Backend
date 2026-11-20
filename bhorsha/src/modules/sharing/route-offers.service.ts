import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, QueryResult, QueryRunner } from 'typeorm';
import { runInTransaction } from '../../common/transaction.js';
import { DriversService } from '../fleet/drivers.service.js';
import { ACTIVE_RIDE_STATUSES } from '../trips/trip-views.js';
import { CreateRouteOfferDto } from './dto/create-route-offer.dto.js';

const DEFAULT_VALID_MINUTES = 60;

const OFFER_COLUMNS = `
  id, driver_id AS "driverId", ride_id AS "rideId", vehicle_id AS "vehicleId",
  vehicle_type AS "vehicleType", from_lat AS "fromLat", from_lng AS "fromLng",
  to_lat AS "toLat", to_lng AS "toLng", seats_offered AS "seatsOffered", status,
  expires_at AS "expiresAt", created_at AS "createdAt"`;

const LOCK_DRIVER_SQL = `
SELECT status
  FROM driver_profiles
 WHERE user_id = $1
   FOR NO KEY UPDATE`;

const FIND_VEHICLE_SQL = `
SELECT id, driver_id AS "driverId", type, seats
  FROM vehicles
 WHERE id = $1 AND deleted_at IS NULL
   FOR SHARE`;

const FIND_LIVE_OFFER_SQL = `
SELECT id
  FROM route_offers
 WHERE driver_id = $1 AND status = 'OPEN' AND expires_at > now()
 LIMIT 1`;

const FIND_ACTIVE_RIDE_SQL = `
SELECT id, is_shared AS "isShared", vehicle_id AS "vehicleId", seats_free AS "seatsFree"
  FROM rides
 WHERE driver_id = $1 AND status = ANY ($2::ride_status[])`;

const INSERT_OFFER_SQL = `
INSERT INTO route_offers (driver_id, ride_id, vehicle_id, vehicle_type, from_lat, from_lng,
                          to_lat, to_lng, seats_offered, expires_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now() + make_interval(mins => $10))
RETURNING ${OFFER_COLUMNS}`;

const LOCK_OFFER_SQL = `
SELECT id, driver_id AS "driverId", status
  FROM route_offers
 WHERE id = $1
   FOR UPDATE`;

const WITHDRAW_OFFER_SQL = `
UPDATE route_offers
   SET status = 'WITHDRAWN'
 WHERE id = $1 AND status = 'OPEN'
RETURNING id, status, updated_at AS "withdrawnAt"`;

const EXPIRE_REQUESTS_SQL = `
UPDATE join_requests
   SET status = 'EXPIRED'
 WHERE route_offer_id = $1 AND status = 'PENDING'
RETURNING id`;

interface OwnVehicle {
  id: number;
  driverId: number;
  type: string;
  seats: number;
}

interface ActiveRide {
  id: number;
  isShared: boolean;
  vehicleId: number;
  seatsFree: number;
}

interface LockedOffer {
  id: number;
  driverId: number;
  status: string;
}

interface RouteOfferRow {
  id: number;
  driverId: number;
  rideId: number | null;
  vehicleId: number;
  vehicleType: string;
  fromLat: string;
  fromLng: string;
  toLat: string;
  toLng: string;
  seatsOffered: number;
  status: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface RouteOffer {
  id: number;
  driverId: number;
  rideId: number | null;
  vehicleId: number;
  vehicleType: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  seatsOffered: number;
  status: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface Withdrawal {
  id: number;
  status: string;
  withdrawnAt: Date;
  expiredRequests: number;
}

@Injectable()
export class RouteOffersService {
  constructor(
    private readonly driversService: DriversService,
    private readonly dataSource: DataSource,
  ) {}

  async create(userId: number, dto: CreateRouteOfferDto): Promise<RouteOffer> {
    if (dto.fromLat === dto.toLat && dto.fromLng === dto.toLng) {
      throw new BadRequestException('Start and end must be different places');
    }

    return runInTransaction(this.dataSource, async (runner) => {
      await this.lockOnlineDriver(runner, userId);
      const vehicle = await this.findOwnVehicle(runner, userId, dto);
      await this.assertNoLiveOffer(runner, userId);
      const rideId = await this.findRideToShare(runner, userId, dto);
      return this.insertOffer(runner, userId, rideId, vehicle, dto);
    });
  }

  async withdraw(userId: number, offerId: number): Promise<Withdrawal> {
    await this.driversService.findMe(userId);

    return runInTransaction(this.dataSource, async (runner) => {
      const offer = await this.lockOffer(runner, offerId);
      if (offer.driverId !== userId) {
        throw new ForbiddenException(
          'This route offer belongs to another driver',
        );
      }
      if (offer.status !== 'OPEN') {
        throw new ConflictException(
          `This route offer is already ${offer.status.toLowerCase()}`,
        );
      }
      const result: QueryResult<Omit<Withdrawal, 'expiredRequests'>> =
        await runner.query(WITHDRAW_OFFER_SQL, [offerId], true);
      const expired: QueryResult = await runner.query(
        EXPIRE_REQUESTS_SQL,
        [offerId],
        true,
      );
      return { ...result.records[0], expiredRequests: expired.records.length };
    });
  }

  private async lockOnlineDriver(
    runner: QueryRunner,
    userId: number,
  ): Promise<void> {
    const rows: { status: string }[] = await runner.query(LOCK_DRIVER_SQL, [
      userId,
    ]);
    if (rows.length === 0) {
      throw new ForbiddenException('Only drivers have a driver profile');
    }
    if (rows[0].status !== 'ONLINE') {
      throw new ForbiddenException('Go online to offer a route');
    }
  }

  private async findOwnVehicle(
    runner: QueryRunner,
    userId: number,
    dto: CreateRouteOfferDto,
  ): Promise<OwnVehicle> {
    const rows: OwnVehicle[] = await runner.query(FIND_VEHICLE_SQL, [
      dto.vehicleId,
    ]);
    if (rows.length === 0) {
      throw new NotFoundException(`Vehicle ${dto.vehicleId} not found`);
    }
    const vehicle = rows[0];
    if (vehicle.driverId !== userId) {
      throw new ForbiddenException('This vehicle belongs to another driver');
    }
    if (vehicle.type === 'BIKE') {
      throw new BadRequestException('A bike cannot be shared');
    }
    if (dto.seatsOffered > vehicle.seats) {
      throw new BadRequestException(
        `This vehicle has only ${vehicle.seats} seats`,
      );
    }
    return vehicle;
  }

  private async assertNoLiveOffer(
    runner: QueryRunner,
    userId: number,
  ): Promise<void> {
    const rows: { id: number }[] = await runner.query(FIND_LIVE_OFFER_SQL, [
      userId,
    ]);
    if (rows.length > 0) {
      throw new ConflictException(
        `You already have an open route offer (id ${rows[0].id})`,
      );
    }
  }

  private async findRideToShare(
    runner: QueryRunner,
    userId: number,
    dto: CreateRouteOfferDto,
  ): Promise<number | null> {
    const rows: ActiveRide[] = await runner.query(FIND_ACTIVE_RIDE_SQL, [
      userId,
      ACTIVE_RIDE_STATUSES,
    ]);
    if (rows.length === 0) {
      return null;
    }
    const ride = rows[0];
    if (!ride.isShared) {
      throw new ConflictException('Your current ride is not shared');
    }
    if (ride.vehicleId !== dto.vehicleId) {
      throw new ConflictException('Use the vehicle of your current ride');
    }
    if (dto.seatsOffered > ride.seatsFree) {
      throw new ConflictException(
        `Seats left on your current ride: ${ride.seatsFree}`,
      );
    }
    return ride.id;
  }

  private async insertOffer(
    runner: QueryRunner,
    userId: number,
    rideId: number | null,
    vehicle: OwnVehicle,
    dto: CreateRouteOfferDto,
  ): Promise<RouteOffer> {
    const result: QueryResult<RouteOfferRow> = await runner.query(
      INSERT_OFFER_SQL,
      [
        userId,
        rideId,
        vehicle.id,
        vehicle.type,
        dto.fromLat,
        dto.fromLng,
        dto.toLat,
        dto.toLng,
        dto.seatsOffered,
        dto.validForMinutes ?? DEFAULT_VALID_MINUTES,
      ],
      true,
    );
    const row = result.records[0];
    return {
      ...row,
      fromLat: Number(row.fromLat),
      fromLng: Number(row.fromLng),
      toLat: Number(row.toLat),
      toLng: Number(row.toLng),
    };
  }

  private async lockOffer(
    runner: QueryRunner,
    offerId: number,
  ): Promise<LockedOffer> {
    const rows: LockedOffer[] = await runner.query(LOCK_OFFER_SQL, [offerId]);
    if (rows.length === 0) {
      throw new NotFoundException(`Route offer ${offerId} not found`);
    }
    return rows[0];
  }
}