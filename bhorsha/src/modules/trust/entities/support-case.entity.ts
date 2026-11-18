import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
export enum CaseType { OVERCHARGE='OVERCHARGE', SAFETY='SAFETY', CONDUCT='CONDUCT', OTHER='OTHER' }
export enum CaseStatus { OPEN='OPEN', UNDER_REVIEW='UNDER_REVIEW', UPHELD='UPHELD', DISMISSED='DISMISSED', WITHDRAWN='WITHDRAWN' }
@Entity('support_cases')
export class SupportCase {
 @PrimaryGeneratedColumn('identity') id: number;
 @Column({type:'enum', enum:CaseType, enumName:'case_type'}) type: CaseType;
 @Column({type:'enum', enum:CaseStatus, enumName:'case_status', default:CaseStatus.OPEN}) status: CaseStatus;
 @Column({name:'reporter_id',type:'integer'}) reporterId: number;
 @Column({name:'subject_id',type:'integer',nullable:true}) subjectId: number|null;
 @Column({name:'ride_id',type:'integer',nullable:true}) rideId: number|null;
 @Column({name:'assigned_to',type:'integer',nullable:true}) assignedTo: number|null;
 @Column({type:'text'}) description: string;
 @Column({name:'amount_claimed_paisa',type:'bigint',nullable:true}) amountClaimedPaisa: string|null;
 @Column({type:'text',nullable:true}) resolution: string|null;
 @Column({name:'resolved_at',type:'timestamptz',nullable:true}) resolvedAt: Date|null;
 @CreateDateColumn({name:'created_at',type:'timestamptz'}) createdAt: Date;
 @UpdateDateColumn({name:'updated_at',type:'timestamptz'}) updatedAt: Date;
}
