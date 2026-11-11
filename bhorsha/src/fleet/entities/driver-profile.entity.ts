import { Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryColumn, type Relation } from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { Vehicle } from './vehicle.entity.js';

export enum DriverVerification {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum DriverAvailability {
  OFFLINE = 'OFFLINE',
  ONLINE = 'ONLINE',
}

@Entity('driver_profiles')
export class DriverProfile {
  @PrimaryColumn({ name: 'user_id' })
  userId: number;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ name: 'licence_no', length: 30, unique: true })
  licenceNo: string;

  @Column({ type: 'enum', enum: DriverVerification, default: DriverVerification.PENDING })
  verification: DriverVerification;

  @Column({ type: 'enum', enum: DriverAvailability, default: DriverAvailability.OFFLINE })
  status: DriverAvailability;

  @Column({ type: 'real', default: 5 })
  rating: number;

  @Column({ name: 'last_lat', type: 'double precision', nullable: true })
  lastLat: number | null;

  @Column({ name: 'last_lng', type: 'double precision', nullable: true })
  lastLng: number | null;

  @Column({ name: 'last_location_at', type: 'timestamptz', nullable: true })
  lastLocationAt: Date | null;

  @OneToMany(() => Vehicle, (vehicle) => vehicle.driver)
  vehicles: Relation<Vehicle[]>;
}