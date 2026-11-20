import { HttpStatus } from '@nestjs/common';

/** The parts of a node-postgres DatabaseError the filter needs. */
export interface PgError {
  code?: string;
  constraint?: string;
}

export interface MappedDatabaseError {
  status: HttpStatus;
  code: string;
  message: string;
}

/**
 * Friendly messages per constraint, from doc/databaseSQL.md section 10.
 * Everything here is 409 unless a status is given.
 */
const CONSTRAINT_MESSAGES: Record<
  string,
  { message: string; status?: HttpStatus }
> = {
  uq_users_phone: { message: 'Phone number already registered' },
  uq_users_email: { message: 'Email already registered' },
  uq_driver_profiles_licence_no: {
    message: 'Licence number already registered',
  },
  uq_vehicles_reg_no_active: { message: 'Registration number already in use' },
  uq_rides_one_active_per_driver: { message: 'You already have an active ride' },
  uq_ride_passengers_one_live_seat_per_rider: {
    message: 'You already have an active ride',
  },
  uq_ratings_ride_from_to: {
    message: 'You already rated this person for this ride',
  },
  uq_strikes_case_user_live: { message: 'A strike for this case already exists' },
  uq_appeals_strike: { message: 'This strike has already been appealed' },
  ck_rides_seats_free: { message: 'Seat no longer available' },
  ck_rides_driver_locked: { message: 'Ride already accepted by another driver' },
  ck_rides_close_with_live_passengers: {
    message: 'Drop off or cancel every passenger first',
  },
  trg_rides_status_transition: {
    message: 'The ride is not in a state that allows this',
  },
  trg_ride_passengers_status_transition: {
    message: 'The passenger is not in a state that allows this',
  },
  trg_join_requests_status_transition: {
    message: 'This request was already answered',
  },
  ck_ride_passengers_picked_up: { message: 'Arrive at the pickup first' },
  ck_ride_passengers_no_show: { message: 'Arrive at the pickup first' },
  ck_fare_rules_within_ceiling: { message: 'Fare is above the legal ceiling' },
  ck_fare_rules_regulation_frozen: {
    message: 'The legal ceiling can only change by migration',
  },
  ck_driver_profiles_online_verified: {
    message: 'Only verified drivers can go online',
  },
  fk_rides_vehicle: { message: 'Use your own vehicle of the requested type' },
  fk_route_offers_vehicle: {
    message: 'Use your own vehicle of the requested type',
  },
  fk_strikes_case_subject: { message: "A strike must name the case's subject" },
  ck_appeals_separation_of_duties: {
    status: HttpStatus.FORBIDDEN,
    message: 'You issued this strike and cannot decide its appeal',
  },
};

/** unique_violation, foreign_key_violation, check_violation */
const INTEGRITY_CODES = new Set(['23505', '23503', '23514']);
/** deadlock, serialization failure, lock not available */
const BUSY_CODES = new Set(['40P01', '40001', '55P03']);
/**
 * A value from the request that the column can't hold, e.g. an id above
 * 2147483647 (the integer limit) or an unknown enum label. That is bad input,
 * so 400 instead of a 500.
 */
const BAD_INPUT_MESSAGES: Record<string, string> = {
  '22003': 'A number in the request is out of range',
  '22P02': 'A value in the request has the wrong format',
};

/**
 * Maps a PostgreSQL error to an HTTP answer, or returns null when it is not a
 * known business rule (the filter then answers 500 and logs it as a bug).
 */
export function mapDatabaseError(
  error: PgError | undefined,
): MappedDatabaseError | null {
  const code = error?.code;
  if (!code) {
    return null;
  }
  if (BUSY_CODES.has(code)) {
    return {
      status: HttpStatus.CONFLICT,
      code: 'BUSY',
      message: 'Busy, please retry',
    };
  }
  const badInput = BAD_INPUT_MESSAGES[code];
  if (badInput) {
    return {
      status: HttpStatus.BAD_REQUEST,
      code: 'BAD_REQUEST',
      message: badInput,
    };
  }
  if (!INTEGRITY_CODES.has(code)) {
    return null;
  }
  const known = error.constraint
    ? CONSTRAINT_MESSAGES[error.constraint]
    : undefined;
  const status = known?.status ?? HttpStatus.CONFLICT;
  return {
    status,
    code: HttpStatus[status],
    message: known?.message ?? 'Request conflicts with the current data',
  };
}
