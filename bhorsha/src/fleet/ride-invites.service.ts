import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { DriversService } from './drivers.service.js';
import { CreateInviteDto } from './dto/create-invite.dto.js';
import { FareRuleRow, quoteSharedFare, SharedFare } from './shared-fare.js';

const INVITE_LIFETIME_SECONDS = 60;
const INVITE_RADIUS_KM = 3;
const RUNNING_STATUSES = ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'];
const LOCK_RIDE_SQL = `
SELECT id, driver_id AS "driverId", status, vehicle_type AS "vehicleType",
       is_shared AS "isShared", seats_free AS "seatsFree"
  FROM rides
 WHERE id = $1
   FOR NO KEY UPDATE`;

const FIND_WAITING_RIDER_SQL = `
SELECT r.status, r.vehicle_type AS "vehicleType", p.rider_id AS "riderId", p.seats,
       p.pickup_lat AS "pickupLat", p.pickup_lng AS "pickupLng",
       p.drop_lat AS "dropLat", p.drop_lng AS "dropLng", p.distance_m AS "distanceM",
       round(d.km::numeric, 2) AS "pickupKm"
  FROM rides r
  JOIN ride_passengers p ON p.ride_id = r.id AND p.join_request_id IS NULL
  JOIN driver_profiles dp ON dp.user_id = $2
 CROSS JOIN LATERAL (
   SELECT 6371 * 2 * asin(sqrt(
            power(sin(radians(p.pickup_lat - dp.last_lat) / 2), 2)
          + cos(radians(dp.last_lat)) * cos(radians(p.pickup_lat))
          * power(sin(radians(p.pickup_lng - dp.last_lng) / 2), 2))) AS km
 ) d
 WHERE r.id = $1
 ORDER BY p.id
 LIMIT 1`;

const FIND_OPEN_REQUEST_SQL = `
SELECT id
  FROM join_requests
 WHERE ride_id = $1 AND rider_id = $2 AND status = 'PENDING' AND expires_at > now()
 LIMIT 1`;

const FIND_FARE_RULE_SQL = `
SELECT id, base_paisa AS "basePaisa", per_km_paisa AS "perKmPaisa",
       base_distance_m AS "baseDistanceM", ceiling_base_paisa AS "ceilingBasePaisa",
       ceiling_per_km_paisa AS "ceilingPerKmPaisa"
  FROM fare_rules
 WHERE vehicle_type = $1`;

const INSERT_INVITE_SQL = `
INSERT INTO join_requests (ride_id, rider_id, driver_id, initiated_by, seats,
                           pickup_lat, pickup_lng, drop_lat, drop_lng, distance_m,
                           quoted_fare_paisa, ceiling_paisa, pricing_snapshot, expires_at)
VALUES ($1, $2, $3, 'DRIVER', $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb,
        now() + make_interval(secs => $13))
RETURNING id, ride_id AS "rideId", rider_id AS "riderId", initiated_by AS "initiatedBy",
          seats, distance_m AS "distanceM", quoted_fare_paisa AS "quotedFarePaisa",
          ceiling_paisa AS "ceilingPaisa", status, expires_at AS "expiresAt"`;

interface LockedRide {
  id: number;
  driverId: number | null;
  status: string;
  vehicleType: string;
  isShared: boolean;
  seatsFree: number;
}
interface WaitingRider {
  status: string;
  vehicleType: string;
  riderId: number;
  seats: number;
  pickupLat: string;
  pickupLng: string;
  dropLat: string;
  dropLng: string;
  distanceM: number;
  pickupKm: string | null;
}

interface InviteRow {
  id: number;
  rideId: number;
  riderId: number;
  initiatedBy: string;
  seats: number;
  distanceM: number;
  quotedFarePaisa: string;
  ceilingPaisa: string;
  status: string;
  expiresAt: Date;
}

export interface Invite {
  id: number;
  rideId: number;
  riderId: number;
  waitingRideId: number;
  initiatedBy: string;
  seats: number;
  pickupKm: number;
  distanceM: number;
  quotedFarePaisa: number;
  ceilingPaisa: number;
  status: string;
  expiresAt: Date;
}

@Injectable()
export class RideInvitesService {
  constructor(
    private readonly driversService: DriversService,
    private readonly dataSource: DataSource,
  ) {}

  async invite(
    userId: number,
    rideId: number,
    dto: CreateInviteDto,
  ): Promise<Invite> {
    await this.driversService.findMe(userId);

    return this.dataSource.transaction(async (manager) => {
      const ride = await this.lockOwnSharedRide(manager, rideId, userId);
      const rider = await this.findWaitingRider(
        manager,
        dto.waitingRideId,
        userId,
      );
      assertRiderFits(ride, rider);
      await this.assertNoOpenRequest(manager, rideId, rider.riderId);
      const fare = await this.quoteFare(manager, ride.vehicleType, rider);
      const row = await this.insertInvite(manager, ride, rider, userId, fare);
      return {
        ...row,
        waitingRideId: dto.waitingRideId,
        pickupKm: Number(rider.pickupKm),
        quotedFarePaisa: Number(row.quotedFarePaisa),
        ceilingPaisa: Number(row.ceilingPaisa),
      };
    });
  }

  private async lockOwnSharedRide(
    manager: EntityManager,
    rideId: number,
    userId: number,
  ): Promise<LockedRide> {
    const rows: LockedRide[] = await manager.query(LOCK_RIDE_SQL, [rideId]);
    if (rows.length === 0) {
      throw new NotFoundException(`Ride ${rideId} not found`);
    }
    const ride = rows[0];
    if (ride.driverId !== userId) {
      throw new ForbiddenException('This ride belongs to another driver');
    }
    if (!RUNNING_STATUSES.includes(ride.status)) {
      throw new ConflictException('This ride is not running');
    }
    if (!ride.isShared) {
      throw new ConflictException('Only a shared ride can take more riders');
    }
    return ride;
  }

  private async findWaitingRider(
    manager: EntityManager,
    waitingRideId: number,
    userId: number,
  ): Promise<WaitingRider> {
    const rows: WaitingRider[] = await manager.query(FIND_WAITING_RIDER_SQL, [
      waitingRideId,
      userId,
    ]);
    if (rows.length === 0) {
      throw new NotFoundException(`Ride request ${waitingRideId} not found`);
    }
    if (rows[0].status !== 'REQUESTED') {
      throw new ConflictException('This rider is no longer waiting');
    }
    return rows[0];
  }

  private async assertNoOpenRequest(
    manager: EntityManager,
    rideId: number,
    riderId: number,
  ): Promise<void> {
    const rows: { id: number }[] = await manager.query(FIND_OPEN_REQUEST_SQL, [
      rideId,
      riderId,
    ]);
    if (rows.length > 0) {
      throw new ConflictException(
        `This rider already has an open request for this ride (id ${rows[0].id})`,
      );
    }
  }

  private async quoteFare(
    manager: EntityManager,
    vehicleType: string,
    rider: WaitingRider,
  ): Promise<SharedFare> {
    const rows: FareRuleRow[] = await manager.query(FIND_FARE_RULE_SQL, [
      vehicleType,
    ]);
    if (rows.length === 0) {
      throw new ConflictException(`No fare rule for ${vehicleType}`);
    }
    return quoteSharedFare(rows[0], vehicleType, rider.distanceM);
  }

  private async insertInvite(
    manager: EntityManager,
    ride: LockedRide,
    rider: WaitingRider,
    userId: number,
    fare: SharedFare,
  ): Promise<InviteRow> {
    const rows: InviteRow[] = await manager.query(INSERT_INVITE_SQL, [
      ride.id,
      rider.riderId,
      userId,
      rider.seats,
      rider.pickupLat,
      rider.pickupLng,
      rider.dropLat,
      rider.dropLng,
      rider.distanceM,
      fare.farePaisa,
      fare.ceilingPaisa,
      JSON.stringify(fare.snapshot),
      INVITE_LIFETIME_SECONDS,
    ]);
    return rows[0];
  }
}

function assertRiderFits(ride: LockedRide, rider: WaitingRider): void {
  if (rider.vehicleType !== ride.vehicleType) {
    throw new ConflictException(`This rider asked for a ${rider.vehicleType}`);
  }
  if (rider.seats > ride.seatsFree) {
    throw new ConflictException(`Seats left on this ride: ${ride.seatsFree}`);
  }
  if (rider.pickupKm === null) {
    throw new ConflictException('Send your location first');
  }
  const pickupKm = Number(rider.pickupKm);
  if (pickupKm > INVITE_RADIUS_KM) {
    throw new ConflictException(
      `This rider is ${pickupKm} km away (limit ${INVITE_RADIUS_KM} km)`,
    );
  }
}