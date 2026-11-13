import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DriversService } from './drivers.service.js';
import { DriverAvailability } from './entities/driver-profile.entity.js';
import { Vehicle } from './entities/vehicle.entity.js';

const SEARCH_RADIUS_KM = 3;
const OPEN_REQUEST_WINDOW = '10 minutes';
const MAX_RESULTS = 20;

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

@Injectable()
export class DriverRidesService {
  constructor(
    private readonly driversService: DriversService,
    @InjectRepository(Vehicle)
    private readonly vehicles: Repository<Vehicle>,
  ) {}

  async findOpen(userId: number): Promise<OpenRide[]> {
    const profile = await this.driversService.findMe(userId);
    if (profile.status !== DriverAvailability.ONLINE) {
      throw new ForbiddenException('Go online to see open rides');
    }
    if (profile.lastLat === null || profile.lastLng === null) {
      throw new ConflictException('Send your location first');
    }

    const myVehicles = await this.vehicles.find({ where: { driverId: userId } });
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
}