import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { VehicleType } from '../../fleet/vehicle-type.js';

@Entity('fare_rules')
export class FareRule {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ name: 'vehicle_type', type: 'enum', enum: VehicleType, enumName: 'vehicle_type', unique: true })
  vehicleType: VehicleType;

  @Column({ name: 'base_paisa', type: 'bigint' })
  basePaisa: number;

  @Column({ name: 'per_km_paisa', type: 'bigint' })
  perKmPaisa: number;

  @Column({ name: 'base_distance_m', type: 'integer' })
  baseDistanceM: number;

  @Column({ name: 'ceiling_base_paisa', type: 'bigint' })
  ceilingBasePaisa: number;

  @Column({ name: 'ceiling_per_km_paisa', type: 'bigint' })
  ceilingPerKmPaisa: number;

  @Column({ name: 'share_discount_bps', type: 'integer' })
  shareDiscountBps: number;

  @Column({ name: 'updated_by', type: 'integer', nullable: true })
  updatedBy: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}