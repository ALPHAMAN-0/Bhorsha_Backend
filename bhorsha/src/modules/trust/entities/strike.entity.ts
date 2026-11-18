import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
export enum StrikeStatus { ACTIVE='ACTIVE', OVERTURNED='OVERTURNED', REVOKED='REVOKED' }
@Entity('strikes')
export class Strike {
 @PrimaryGeneratedColumn('identity') id: number;
 @Column({name:'user_id',type:'integer'}) userId: number;
 @Column({name:'case_id',type:'integer'}) caseId: number;
 @Column({name:'issued_by',type:'integer'}) issuedBy: number;
 @Column({type:'text'}) reason: string;
 @Column({type:'enum',enum:StrikeStatus,enumName:'strike_status',default:StrikeStatus.ACTIVE}) status: StrikeStatus;
 @Column({name:'issued_at',type:'timestamptz'}) issuedAt: Date;
 @Column({name:'expires_at',type:'timestamptz'}) expiresAt: Date;
 @Column({name:'revoked_at',type:'timestamptz',nullable:true}) revokedAt: Date|null;
 @CreateDateColumn({name:'created_at',type:'timestamptz'}) createdAt: Date;
 @UpdateDateColumn({name:'updated_at',type:'timestamptz'}) updatedAt: Date;
}
