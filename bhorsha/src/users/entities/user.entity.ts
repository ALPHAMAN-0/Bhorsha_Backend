import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum Role {
  RIDER = 'RIDER',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN',
  SUPPORT = 'SUPPORT',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ name: 'full_name', type: 'varchar', length: 100 })
  fullName: string;

  @Column({ type: 'varchar', length: 16, unique: true })
  phone: string;

  @Column({ type: 'varchar', length: 254, unique: true, nullable: true })
  email: string | null;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash: string;

  @Column({ type: 'enum', enum: Role, enumName: 'user_role' })
  role: Role;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'suspended_until', type: 'timestamptz', nullable: true })
  suspendedUntil: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}