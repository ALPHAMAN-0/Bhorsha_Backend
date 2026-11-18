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

  @Column({ type: 'int' })
  ride_id: number;

  @Column({ type: 'int' })
  rider_id: number;

  @Column({ type: 'int', nullable: true })
  passenger_id: number;

  @Column({ type: 'int', nullable: true })
  join_request_id: number | null;

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

  @Column({ type: 'timestamptz', nullable: true })
  cancelled_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  joined_at: Date;
}
