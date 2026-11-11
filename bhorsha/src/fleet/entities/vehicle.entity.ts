import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { VehicleType } from '../vehicle-type.js';
import { DriverProfile } from './driver-profile.entity.js';

@Entity('vehicles')
@Check('"seats" BETWEEN 1 AND 3')
export class Vehicle {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => DriverProfile, (driver) => driver.vehicles, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'driver_id' })
  driver: Relation<DriverProfile>;

  @Column({ name: 'driver_id' })
  driverId: number;

  @Column({ type: 'enum', enum: VehicleType })
  type: VehicleType;

  @Column({ name: 'reg_no', length: 30, unique: true })
  regNo: string;

  @Column({ type: 'smallint' })
  seats: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}