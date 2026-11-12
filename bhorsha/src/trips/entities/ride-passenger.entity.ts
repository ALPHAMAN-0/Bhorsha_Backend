import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum PassengerStatus {
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

@Entity('ride_passengers')
export class RidePassenger {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  ride_id: string;

  @Column({ type: 'int' })
  passenger_id: number;

  @Column({ type: 'int', default: 1 })
  seats: number;

  @Column({ type: 'int', default: 0 })
  fare_share_bdt: number;

  @Column({
    type: 'enum',
    enum: PassengerStatus,
    default: PassengerStatus.CONFIRMED,
  })
  status: PassengerStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  joined_at: Date;
}
