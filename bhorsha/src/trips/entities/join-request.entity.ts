import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum JoinRequestStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  CANCELLED = 'CANCELLED',
}

@Entity('join_requests')
export class JoinRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  ride_id: number;

  @Column({ type: 'int' })
  rider_id: number;

  @Column({ type: 'int', nullable: true })
  passenger_id: number;

  @Column({ type: 'double precision', default: 23.8103 })
  pickup_lat: number;

  @Column({ type: 'double precision', default: 90.4125 })
  pickup_lng: number;

  @Column({ type: 'double precision', default: 23.7925 })
  drop_lat: number;

  @Column({ type: 'double precision', default: 90.4078 })
  drop_lng: number;

  @Column({ type: 'double precision', default: 23.7925 })
  dropoff_lat: number;

  @Column({ type: 'double precision', default: 90.4078 })
  dropoff_lng: number;

  @Column({ type: 'int', default: 1 })
  seats: number;

  @Column({ type: 'int', default: 0 })
  fare_share_bdt: number;

  @Column({
    type: 'enum',
    enum: JoinRequestStatus,
    default: JoinRequestStatus.PENDING,
  })
  status: JoinRequestStatus;

  @Column({ type: 'timestamptz', nullable: true })
  decided_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
