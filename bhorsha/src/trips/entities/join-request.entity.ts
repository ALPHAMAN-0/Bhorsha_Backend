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

  @Column({ type: 'varchar', length: 100 })
  ride_id: string;

  @Column({ type: 'int' })
  passenger_id: number;

  @Column({ type: 'double precision', default: 23.8103 })
  pickup_lat: number;

  @Column({ type: 'double precision', default: 90.4125 })
  pickup_lng: number;

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

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
