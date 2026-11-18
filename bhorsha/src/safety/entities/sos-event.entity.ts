import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum SosStatus {
  TRIGGERED = 'TRIGGERED',
  INVESTIGATING = 'INVESTIGATING',
  RESOLVED = 'RESOLVED',
}

@Entity('sos_events')
export class SosEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ride_id: string | null;

  @Column({ type: 'int' })
  user_id: number;

  @Column({ type: 'double precision', nullable: true })
  lat: number | null;

  @Column({ type: 'double precision', nullable: true })
  lng: number | null;

  @Column({
    type: 'enum',
    enum: SosStatus,
    default: SosStatus.TRIGGERED,
  })
  status: SosStatus;

  @Column({ type: 'text', nullable: true })
  resolution_notes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
