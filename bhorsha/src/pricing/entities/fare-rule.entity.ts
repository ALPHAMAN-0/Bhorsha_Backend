import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VehicleType } from '../../fleet/vehicle-type.js';

@Entity('fare_rules')
export class FareRule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: VehicleType,
    unique: true,
  })
  vehicle_type: VehicleType;

  @Column({ type: 'int', default: 8500 }) // Base fare in paisa (85.00 BDT)
  base_fare: number;

  @Column({ type: 'int', default: 3400 }) // 34.00 BDT per km in paisa
  per_km_rate: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 1.2 }) // BRTA ceiling: max 120%
  max_multiplier: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
