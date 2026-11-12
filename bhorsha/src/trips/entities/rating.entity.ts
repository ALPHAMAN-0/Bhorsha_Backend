import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('ratings')
@Check('"score" BETWEEN 1 AND 5')
export class Rating {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  ride_id: string;

  @Column({ type: 'int' })
  rater_id: number;

  @Column({ type: 'int' })
  ratee_id: number;

  @Column({ type: 'smallint' })
  score: number;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
