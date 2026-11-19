import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VehicleType } from '../../fleet/vehicle-type.js';

/** ride_status (doc/databaseSQL.md section 7). OFFERING and AWAITING_HANDOVER are not used by course code yet. */
export enum RideStatus {
  REQUESTED = 'REQUESTED',
  OFFERING = 'OFFERING',
  ACCEPTED = 'ACCEPTED',
  ARRIVED = 'ARRIVED',
  IN_PROGRESS = 'IN_PROGRESS',
  AWAITING_HANDOVER = 'AWAITING_HANDOVER',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum RideCancelReason {
  RIDER_CANCELLED = 'RIDER_CANCELLED',
  DRIVER_CANCELLED = 'DRIVER_CANCELLED',
  NO_DRIVER_FOUND = 'NO_DRIVER_FOUND',
  HANDOVER_FAILED = 'HANDOVER_FAILED',
  JOINED_ANOTHER_RIDE = 'JOINED_ANOTHER_RIDE',
}

/**
 * The trip itself (schema v2). Who rides, their stops and their fare live in
 * ride_passengers, one row per rider, so a shared ride can carry several.
 */
@Entity('rides')
export class Ride {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'enum', enum: VehicleType, enumName: 'vehicle_type' })
  vehicle_type: VehicleType;

  @Column({ type: 'boolean', default: false })
  is_shared: boolean;

  @Column({ type: 'smallint' })
  seats_total: number;

  @Column({ type: 'smallint' })
  seats_free: number;

  @Column({
    type: 'enum',
    enum: RideStatus,
    enumName: 'ride_status',
    default: RideStatus.REQUESTED,
  })
  status: RideStatus;

  @Column({ type: 'integer', nullable: true })
  driver_id: number | null;

  @Column({ type: 'integer', nullable: true })
  vehicle_id: number | null;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @Column({
    type: 'enum',
    enum: RideCancelReason,
    enumName: 'ride_cancel_reason',
    nullable: true,
  })
  cancel_reason: RideCancelReason | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  accepted_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  started_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelled_at: Date | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
