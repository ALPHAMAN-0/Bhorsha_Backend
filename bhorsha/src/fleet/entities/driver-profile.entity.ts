import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryColumn,
  type Relation,
  type ValueTransformer,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { Vehicle } from './vehicle.entity.js';

export enum DriverVerification {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export enum DriverAvailability {
  OFFLINE = 'OFFLINE',
  ONLINE = 'ONLINE',
}

const decimal: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

@Entity('driver_profiles')
export class DriverProfile {
  @PrimaryColumn({ name: 'user_id' })
  userId: number;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ name: 'licence_no', length: 30, unique: true })
  licenceNo: string;

  @Column({
    type: 'enum',
    enum: DriverVerification,
    default: DriverVerification.PENDING,
  })
  verification: DriverVerification;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({
    type: 'enum',
    enum: DriverAvailability,
    default: DriverAvailability.OFFLINE,
  })
  status: DriverAvailability;

  @Column({
    name: 'last_lat',
    type: 'numeric',
    nullable: true,
    transformer: decimal,
  })
  lastLat: number | null;

  @Column({
    name: 'last_lng',
    type: 'numeric',
    nullable: true,
    transformer: decimal,
  })
  lastLng: number | null;

  @Column({ name: 'last_location_at', type: 'timestamptz', nullable: true })
  lastLocationAt: Date | null;

  @OneToMany(() => Vehicle, (vehicle) => vehicle.driver)
  vehicles: Relation<Vehicle[]>;
}