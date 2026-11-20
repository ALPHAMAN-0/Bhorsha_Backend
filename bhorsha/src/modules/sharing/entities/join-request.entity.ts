import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** A PENDING request whose expires_at has passed counts as EXPIRED (computed on read). */
export enum JoinRequestStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
}

export enum JoinInitiator {
  RIDER = 'RIDER',
  DRIVER = 'DRIVER',
}

/**
 * A proposal to share a ride: a rider asking to join (RIDER) or a driver's
 * invite (DRIVER). It targets exactly one of a running ride or a route offer,
 * and becomes a ride_passengers seat only through the seat transaction.
 */
@Entity('join_requests')
export class JoinRequest {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'integer', nullable: true })
  ride_id: number | null;

  @Column({ type: 'integer', nullable: true })
  route_offer_id: number | null;

  @Column({ type: 'integer' })
  rider_id: number;

  @Column({ type: 'integer' })
  driver_id: number;

  @Column({ type: 'enum', enum: JoinInitiator, enumName: 'join_initiator' })
  initiated_by: JoinInitiator;

  @Column({ type: 'smallint', default: 1 })
  seats: number;

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
  quoted_fare_paisa: number;

  @Column({ type: 'bigint' })
  ceiling_paisa: number;

  @Column({ type: 'jsonb' })
  pricing_snapshot: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: JoinRequestStatus,
    enumName: 'join_request_status',
    default: JoinRequestStatus.PENDING,
  })
  status: JoinRequestStatus;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  decided_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
