import { randomInt } from 'node:crypto';
import { type AuthUser, isStaff } from '../../common/guards/auth-user.js';
import { paisaToTk } from '../../common/money.js';

/**
 * Row shapes as raw SQL returns them (parseInt8 is on, so bigint is a number;
 * numeric coordinates come back as strings), and the API views built from them.
 * Money is stored in paisa and shown in Tk (_bdt).
 */

export interface RideRow {
  id: number;
  vehicle_type: string;
  is_shared: boolean;
  seats_total: number;
  seats_free: number;
  status: string;
  driver_id: number | null;
  vehicle_id: number | null;
  version: number;
  cancel_reason: string | null;
  created_at: Date;
  accepted_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
}

export interface PassengerRow {
  id: number;
  ride_id: number;
  rider_id: number;
  join_request_id: number | null;
  seats: number;
  status: string;
  pickup_lat: string;
  pickup_lng: string;
  drop_lat: string;
  drop_lng: string;
  distance_m: number;
  locked_fare_paisa: number;
  ceiling_paisa: number;
  pricing_snapshot: Record<string, unknown>;
  pickup_pin: string;
  arrived_at: Date | null;
  picked_up_at: Date | null;
  dropped_at: Date | null;
  cancelled_at: Date | null;
  created_at: Date;
}

export interface Point {
  lat: number;
  lng: number;
}

export interface PassengerView {
  id: number;
  rider_id: number;
  status: string;
  seats: number;
  join_request_id?: number | null;
  origin?: string | null;
  destination?: string | null;
  pickup?: Point;
  drop?: Point;
  distance_km?: number;
  fare_bdt?: number;
  ceiling_bdt?: number;
  /** Only for the rider who owns the seat: they tell it to the driver at pickup. */
  pickup_pin?: string;
}

export interface RideView {
  id: number;
  status: string;
  vehicle_type: string;
  is_shared: boolean;
  seats_total: number;
  seats_free: number;
  driver_id: number | null;
  vehicle_id: number | null;
  cancel_reason: string | null;
  created_at: Date;
  accepted_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
  passengers: PassengerView[];
}

export const LIVE_SEAT_STATUSES = ['CONFIRMED', 'PICKED_UP'];
/** A ride with its driver that has not finished yet. */
export const RUNNING_RIDE_STATUSES = ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'];
/** A ride that still holds its driver's vehicle: running, or waiting for a handover. */
export const ACTIVE_RIDE_STATUSES = [...RUNNING_RIDE_STATUSES, 'AWAITING_HANDOVER'];

/** A new 4-digit pickup PIN (0000-9999), from a secure random source. */
export function newPickupPin(): string {
  return String(randomInt(0, 10000)).padStart(4, '0');
}

/** Straight-line (haversine) distance in metres. */
export function straightLineMeters(from: Point, to: Point): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(to.lat - from.lat);
  const dLng = rad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371000 * 2 * Math.asin(Math.sqrt(a)));
}

/** The trip distance in metres: the rider's route distance if given, else the straight line. */
export function tripMeters(distanceKm: number | undefined, from: Point, to: Point): number {
  return distanceKm !== undefined
    ? Math.round(distanceKm * 1000)
    : straightLineMeters(from, to);
}

/** A stop from its numeric columns, which raw SQL returns as strings. */
export const point = (lat: string, lng: string): Point => ({ lat: Number(lat), lng: Number(lng) });

/**
 * Everyone on the ride sees each seat's status. The seat's own rider, the
 * ride's driver and staff also see stops and fare; only the seat's rider sees
 * the pickup PIN.
 */
export function toPassengerView(
  p: PassengerRow,
  ride: Pick<RideRow, 'driver_id'>,
  viewer: AuthUser,
): PassengerView {
  const view: PassengerView = {
    id: p.id,
    rider_id: p.rider_id,
    status: p.status,
    seats: p.seats,
  };
  const isOwner = viewer.id === p.rider_id;
  if (isOwner || viewer.id === ride.driver_id || isStaff(viewer)) {
    Object.assign(view, {
      join_request_id: p.join_request_id,
      origin: (p.pricing_snapshot?.originLabel as string | undefined) ?? null,
      destination: (p.pricing_snapshot?.destinationLabel as string | undefined) ?? null,
      pickup: point(p.pickup_lat, p.pickup_lng),
      drop: point(p.drop_lat, p.drop_lng),
      distance_km: p.distance_m / 1000,
      fare_bdt: paisaToTk(p.locked_fare_paisa),
      ceiling_bdt: paisaToTk(p.ceiling_paisa),
    });
  }
  if (isOwner) {
    view.pickup_pin = p.pickup_pin;
  }
  return view;
}

export function toRideView(
  ride: RideRow,
  passengers: PassengerRow[],
  viewer: AuthUser,
): RideView {
  return {
    id: ride.id,
    status: ride.status,
    vehicle_type: ride.vehicle_type,
    is_shared: ride.is_shared,
    seats_total: ride.seats_total,
    seats_free: ride.seats_free,
    driver_id: ride.driver_id,
    vehicle_id: ride.vehicle_id,
    cancel_reason: ride.cancel_reason,
    created_at: ride.created_at,
    accepted_at: ride.accepted_at,
    started_at: ride.started_at,
    completed_at: ride.completed_at,
    cancelled_at: ride.cancelled_at,
    passengers: passengers
      .filter((p) => p.ride_id === ride.id)
      .map((p) => toPassengerView(p, ride, viewer)),
  };
}
