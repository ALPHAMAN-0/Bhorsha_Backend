import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PassengerStatus {
  CONFIRMED = 'CONFIRMED',
  PICKED_UP = 'PICKED_UP',
  DROPPED = 'DROPPED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

/**
 * One rider's seat on a ride: their own stops, distance, locked fare and
 * pickup PIN. Money is stored in paisa; the API shows it in Tk.
 */
@Entity('ride_passengers')
export class RidePassenger {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'integer' })
  ride_id: number;

  @Column({ type: 'integer' })
  rider_id: number;

  /** NULL for the rider who booked the ride; set when the seat came from a join request or invite. */
  @Column({ type: 'integer', nullable: true })
  join_request_id: number | null;

  @Column({ type: 'smallint', default: 1 })
  seats: number;

  @Column({
    type: 'enum',
    enum: PassengerStatus,
    enumName: 'passenger_status',
    default: PassengerStatus.CONFIRMED,
  })
  status: PassengerStatus;

  @Column({ type: 'numeric', precision: 9, scale: 6 })
  pickup_lat: string;

  @Column({ type: 'numeric', precision: 9, scale: 6 })
  pickup_lng: string;

  @Column({ type: 'numeric', precision: 9, scale: 6 })
  drop_lat: string;

  @Column({ type: 'numeric', precision: 9, scale: 6 })
  drop_lng: string;

  @Column({ type: 'integer' })
  distance_m: number;

  @Column({ type: 'bigint' })
  locked_fare_paisa: number;

  @Column({ type: 'bigint' })
  ceiling_paisa: number;

  @Column({ type: 'jsonb' })
  pricing_snapshot: Record<string, unknown>;

  /** 4 digits, shown only to this rider. */
  @Column({ type: 'varchar', length: 4, select: false })
  pickup_pin: string;

  @Column({ type: 'timestamptz', nullable: true })
  arrived_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  picked_up_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  dropped_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelled_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
