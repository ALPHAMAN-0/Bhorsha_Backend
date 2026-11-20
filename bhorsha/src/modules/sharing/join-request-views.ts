import { paisaToTk } from '../../common/money.js';
import { type Point, point } from '../trips/trip-views.js';

/**
 * A join_requests row as raw SQL returns it (numeric stops come back as
 * strings), and the API view built from it. Money is stored in paisa and shown
 * in Tk (_bdt).
 */

export interface JoinRequestRow {
  id: number;
  ride_id: number | null;
  route_offer_id: number | null;
  rider_id: number;
  driver_id: number;
  initiated_by: string;
  seats: number;
  pickup_lat: string;
  pickup_lng: string;
  drop_lat: string;
  drop_lng: string;
  distance_m: number;
  quoted_fare_paisa: number;
  ceiling_paisa: number;
  pricing_snapshot: Record<string, unknown>;
  status: string;
  expires_at: Date;
  decided_at: Date | null;
  created_at: Date;
}

export interface JoinRequestView {
  id: number;
  ride_id: number | null;
  route_offer_id: number | null;
  rider_id: number;
  driver_id: number;
  initiated_by: string;
  seats: number;
  pickup: Point;
  drop: Point;
  distance_km: number;
  quoted_fare_bdt: number;
  ceiling_bdt: number;
  status: string;
  expires_at: Date;
  decided_at: Date | null;
  created_at: Date;
}

/** A PENDING request past its expires_at is shown as EXPIRED (expiry is computed on read). */
export function toJoinRequestView(row: JoinRequestRow, now: Date = new Date()): JoinRequestView {
  const expired = row.status === 'PENDING' && new Date(row.expires_at) <= now;
  return {
    id: row.id,
    ride_id: row.ride_id,
    route_offer_id: row.route_offer_id,
    rider_id: row.rider_id,
    driver_id: row.driver_id,
    initiated_by: row.initiated_by,
    seats: row.seats,
    pickup: point(row.pickup_lat, row.pickup_lng),
    drop: point(row.drop_lat, row.drop_lng),
    distance_km: row.distance_m / 1000,
    quoted_fare_bdt: paisaToTk(row.quoted_fare_paisa),
    ceiling_bdt: paisaToTk(row.ceiling_paisa),
    status: expired ? 'EXPIRED' : row.status,
    expires_at: row.expires_at,
    decided_at: row.decided_at,
    created_at: row.created_at,
  };
}
