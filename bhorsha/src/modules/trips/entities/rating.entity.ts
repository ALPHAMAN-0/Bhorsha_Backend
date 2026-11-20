import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** One rating per direction per ride (uq_ratings_ride_from_to); 1 to 5 stars; never yourself. */
@Entity('ratings')
export class Rating {
  @PrimaryGeneratedColumn('identity', { generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'integer' })
  ride_id: number;

  @Column({ type: 'integer' })
  from_user_id: number;

  @Column({ type: 'integer' })
  to_user_id: number;

  @Column({ type: 'smallint' })
  stars: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  comment: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
