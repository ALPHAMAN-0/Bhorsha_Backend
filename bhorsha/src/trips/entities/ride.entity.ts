import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VehicleType } from '../../fleet/vehicle-type.js';

export enum RideStatus {
  REQUESTED = 'REQUESTED',
  MATCHED = 'MATCHED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('rides')
export class Ride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  rider_id: number;

  @Column({ type: 'int', nullable: true })
  driver_id: number | null;

  @Column({ type: 'enum', enum: VehicleType, default: VehicleType.CAR })
  vehicle_type: VehicleType;

  @Column({ type: 'varchar', length: 255 })
  origin: string;

  @Column({ type: 'varchar', length: 255 })
  destination: string;

  @Column({ type: 'double precision', default: 23.8103 })
  origin_lat: number;

  @Column({ type: 'double precision', default: 90.4125 })
  origin_lng: number;

  @Column({ type: 'double precision', default: 23.7925 })
  dest_lat: number;

  @Column({ type: 'double precision', default: 90.4078 })
  dest_lng: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 5.0 })
  distance_km: number;

  @Column({ type: 'int', default: 255 }) // Stored in BDT
  fare_bdt: number;

  @Column({ type: 'enum', enum: RideStatus, default: RideStatus.REQUESTED })
  status: RideStatus;

  @Column({ type: 'boolean', default: false })
  is_shared: boolean;

  @Column({ type: 'int', default: 1 })
  seats_total: number;

  @Column({ type: 'int', default: 1 })
  seats_booked: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
