import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  QueryFailedError,
  QueryResult,
  QueryRunner,
  Repository,
} from 'typeorm';
import { DriversService } from './drivers.service.js';
import { DriverAvailability } from './entities/driver-profile.entity.js';
import { Vehicle } from './entities/vehicle.entity.js';

const SEARCH_RADIUS_KM = 3;
const OPEN_REQUEST_WINDOW = '10 minutes';
const MAX_RESULTS = 20;
const ACTIVE_RIDE_INDEX = 'uq_rides_one_active_per_driver';
const PICKUP_STATUSES = ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'];

const OPEN_RIDES_SQL = `
SELECT r.id AS "rideId",
       r.vehicle_type AS "vehicleType",
       r.is_shared AS "isShared",
       r.seats_free AS "seatsFree",
       p.locked_fare_paisa AS "farePaisa",
       round(d.km::numeric, 2) AS "distanceKm"
  FROM rides r
  JOIN ride_passengers p
    ON p.ride_id = r.id AND p.status = 'CONFIRMED' AND p.join_request_id IS NULL
 CROSS JOIN LATERAL (
   SELECT 6371 * 2 * asin(sqrt(
            power(sin(radians(p.pickup_lat - $1::numeric) / 2), 2)
          + cos(radians($1::numeric)) * cos(radians(p.pickup_lat))
          * power(sin(radians(p.pickup_lng - $2::numeric) / 2), 2))) AS km
 ) d
 WHERE r.status = 'REQUESTED'
   AND r.vehicle_type = ANY ($3::vehicle_type[])
   AND r.created_at > now() - $4::interval
   AND p.pickup_lat BETWEEN $1::numeric - 0.027 AND $1::numeric + 0.027
   AND p.pickup_lng BETWEEN $2::numeric - 0.030 AND $2::numeric + 0.030
   AND d.km <= $5
 ORDER BY d.km
 LIMIT $6`;

const LOCK_RIDE_SQL = `
SELECT id, status, vehicle_type AS "vehicleType", driver_id AS "driverId", version
  FROM rides
 WHERE id = $1
   FOR UPDATE`;

const FIND_VEHICLE_SQL = `
SELECT id
  FROM vehicles
 WHERE driver_id = $1 AND type = $2 AND deleted_at IS NULL
 ORDER BY id
 LIMIT 1
   FOR SHARE`;

const ACCEPT_RIDE_SQL = `
UPDATE rides
   SET status = 'ACCEPTED', driver_id = $2, vehicle_id = $3, accepted_at = now()
 WHERE id = $1 AND status = 'REQUESTED' AND version = $4
RETURNING id AS "rideId", status, vehicle_type AS "vehicleType", is_shared AS "isShared",
          seats_free AS "seatsFree", driver_id AS "driverId", vehicle_id AS "vehicleId",
          accepted_at AS "acceptedAt", version`;

const MARK_ARRIVAL_SQL = `
UPDATE ride_passengers
   SET arrived_at = now()
 WHERE id = (SELECT id
               FROM ride_passengers
              WHERE ride_id = $1 AND status = 'CONFIRMED' AND arrived_at IS NULL
              ORDER BY id
              LIMIT 1
                FOR UPDATE)
RETURNING id AS "passengerId", arrived_at AS "arrivedAt"`;

const MOVE_TO_ARRIVED_SQL = `
UPDATE rides
   SET status = 'ARRIVED'
 WHERE id = $1 AND status = 'ACCEPTED' AND version = $2`;

const LOCK_PASSENGER_SQL = `
SELECT id, status, arrived_at IS NOT NULL AS "hasArrived", pickup_pin = $3 AS "pinMatches"
  FROM ride_passengers
 WHERE id = $1 AND ride_id = $2
   FOR UPDATE`;

const PICK_UP_SQL = `
UPDATE ride_passengers
   SET status = 'PICKED_UP', picked_up_at = now()
 WHERE id = $1 AND status = 'CONFIRMED' AND pickup_pin = $2
RETURNING id AS "passengerId", status AS "passengerStatus", picked_up_at AS "pickedUpAt"`;

const START_RIDE_SQL = `
UPDATE rides
   SET status = 'IN_PROGRESS', started_at = now()
 WHERE id = $1 AND status = 'ARRIVED' AND version = $2`;

interface OpenRideRow {
  rideId: number;
  vehicleType: string;
  isShared: boolean;
  seatsFree: number;
  farePaisa: string;
  distanceKm: string;
}

export interface OpenRide {
  rideId: number;
  vehicleType: string;
  isShared: boolean;
  seatsFree: number;
  farePaisa: number;
  distanceKm: number;
}

interface LockedRide {
  id: number;
  status: string;
  vehicleType: string;
  driverId: number | null;
  version: number;
}

export interface AcceptedRide {
  rideId: number;
  status: string;
  vehicleType: string;
  isShared: boolean;
  seatsFree: number;
  driverId: number;
  vehicleId: number;
  acceptedAt: Date;
  version: number;
}

export interface Arrival {
  rideId: number;
  status: string;
  passengerId: number;
  arrivedAt: Date;
}

interface LockedPassenger {
  id: number;
  status: string;
  hasArrived: boolean;
  pinMatches: boolean;
}

export interface Pickup {
  rideId: number;
  rideStatus: string;
  passengerId: number;
  passengerStatus: string;
  pickedUpAt: Date;
}

@Injectable()
export class DriverRidesService {
  constructor(
    private readonly driversService: DriversService,
    @InjectRepository(Vehicle)
    private readonly vehicles: Repository<Vehicle>,
    private readonly dataSource: DataSource,
  ) {}

  async findOpen(userId: number): Promise<OpenRide[]> {
    const profile = await this.driversService.findMe(userId);
    if (profile.status !== DriverAvailability.ONLINE) {
      throw new ForbiddenException('Go online to see open rides');
    }
    if (profile.lastLat === null || profile.lastLng === null) {
      throw new ConflictException('Send your location first');
    }

    const myVehicles = await this.vehicles.find({
      where: { driverId: userId },
    });
    const types = [...new Set(myVehicles.map((vehicle) => vehicle.type))];
    if (types.length === 0) {
      return [];
    }

    const rows: OpenRideRow[] = await this.vehicles.query(OPEN_RIDES_SQL, [
      profile.lastLat,
      profile.lastLng,
      types,
      OPEN_REQUEST_WINDOW,
      SEARCH_RADIUS_KM,
      MAX_RESULTS,
    ]);

    return rows.map((row) => ({
      ...row,
      farePaisa: Number(row.farePaisa),
      distanceKm: Number(row.distanceKm),
    }));
  }

  async accept(userId: number, rideId: number): Promise<AcceptedRide> {
    const profile = await this.driversService.findMe(userId);
    if (profile.status !== DriverAvailability.ONLINE) {
      throw new ForbiddenException('Go online to accept rides');
    }

    return this.inTransaction(async (runner) => {
      const ride = await this.lockRide(runner, rideId);
      if (ride.status !== 'REQUESTED') {
        throw new ConflictException('Ride is no longer available');
      }
      const vehicleId = await this.findVehicleFor(
        runner,
        userId,
        ride.vehicleType,
      );
      return this.markAccepted(runner, ride, userId, vehicleId);
    });
  }

  async arrive(userId: number, rideId: number): Promise<Arrival> {
    await this.driversService.findMe(userId);

    return this.inTransaction(async (runner) => {
      const ride = await this.lockRideForPickup(runner, rideId, userId);
      const result: QueryResult = await runner.query(
        MARK_ARRIVAL_SQL,
        [rideId],
        true,
      );
      if (result.records.length === 0) {
        throw new ConflictException('No passenger is waiting for a pickup');
      }
      const status = await this.moveToArrived(runner, ride);
      return { rideId, status, ...result.records[0] } as Arrival;
    });
  }

  async pickup(
    userId: number,
    rideId: number,
    passengerId: number,
    pin: string,
  ): Promise<Pickup> {
    await this.driversService.findMe(userId);

    return this.inTransaction(async (runner) => {
      const ride = await this.lockRideForPickup(runner, rideId, userId);
      await this.checkPassenger(runner, rideId, passengerId, pin);
      const result: QueryResult = await runner.query(
        PICK_UP_SQL,
        [passengerId, pin],
        true,
      );
      if (result.records.length === 0) {
        throw new ConflictException(
          'This passenger is not waiting for a pickup',
        );
      }
      const rideStatus = await this.startRide(runner, ride);
      return { rideId, rideStatus, ...result.records[0] } as Pickup;
    });
  }


  private async inTransaction<T>(
    work: (runner: QueryRunner) => Promise<T>,
  ): Promise<T> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const result = await work(runner);
      await runner.commitTransaction();
      return result;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  private async lockRide(
    runner: QueryRunner,
    rideId: number,
  ): Promise<LockedRide> {
    const rows: LockedRide[] = await runner.query(LOCK_RIDE_SQL, [rideId]);
    if (rows.length === 0) {
      throw new NotFoundException(`Ride ${rideId} not found`);
    }
    return rows[0];
  }

  private async lockRideForPickup(
    runner: QueryRunner,
    rideId: number,
    userId: number,
  ): Promise<LockedRide> {
    const ride = await this.lockRide(runner, rideId);
    if (ride.driverId !== userId) {
      throw new ForbiddenException('This ride belongs to another driver');
    }
    if (!PICKUP_STATUSES.includes(ride.status)) {
      throw new ConflictException('This ride is not waiting for a pickup');
    }
    return ride;
  }

  private async checkPassenger(
    runner: QueryRunner,
    rideId: number,
    passengerId: number,
    pin: string,
  ): Promise<void> {
    const rows: LockedPassenger[] = await runner.query(LOCK_PASSENGER_SQL, [
      passengerId,
      rideId,
      pin,
    ]);
    if (rows.length === 0) {
      throw new NotFoundException(
        `Passenger ${passengerId} is not on ride ${rideId}`,
      );
    }
    const passenger = rows[0];
    if (passenger.status !== 'CONFIRMED') {
      throw new ConflictException('This passenger is not waiting for a pickup');
    }
    if (!passenger.hasArrived) {
      throw new ConflictException('Arrive at the pickup first');
    }
    if (!passenger.pinMatches) {
      throw new BadRequestException('Wrong PIN');
    }
  }

  private async findVehicleFor(
    runner: QueryRunner,
    userId: number,
    vehicleType: string,
  ): Promise<number> {
    const rows: { id: number }[] = await runner.query(FIND_VEHICLE_SQL, [
      userId,
      vehicleType,
    ]);
    if (rows.length === 0) {
      throw new ConflictException(
        `You need an active ${vehicleType} for this ride`,
      );
    }
    return rows[0].id;
  }

  private async markAccepted(
    runner: QueryRunner,
    ride: LockedRide,
    userId: number,
    vehicleId: number,
  ): Promise<AcceptedRide> {
    try {
      const result: QueryResult<AcceptedRide> = await runner.query(
        ACCEPT_RIDE_SQL,
        [ride.id, userId, vehicleId, ride.version],
        true,
      );
      if (result.records.length === 0) {
        throw new ConflictException('Ride is no longer available');
      }
      return result.records[0];
    } catch (error) {
      if (isActiveRideClash(error)) {
        throw new ConflictException('You already have an active ride');
      }
      throw error;
    }
  }

  private async moveToArrived(
    runner: QueryRunner,
    ride: LockedRide,
  ): Promise<string> {
    if (ride.status !== 'ACCEPTED') {
      return ride.status;
    }
    await runner.query(MOVE_TO_ARRIVED_SQL, [ride.id, ride.version]);
    return 'ARRIVED';
  }

  private async startRide(
    runner: QueryRunner,
    ride: LockedRide,
  ): Promise<string> {
    if (ride.status !== 'ARRIVED') {
      return ride.status;
    }
    await runner.query(START_RIDE_SQL, [ride.id, ride.version]);
    return 'IN_PROGRESS';
  }
}

function isActiveRideClash(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = error.driverError as { constraint?: string };
  return driverError.constraint === ACTIVE_RIDE_INDEX;
}