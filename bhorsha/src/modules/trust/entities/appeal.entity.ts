import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
export enum AppealStatus { PENDING='PENDING', ACCEPTED='ACCEPTED', REJECTED='REJECTED' }
@Entity('appeals')
export class Appeal {
 @PrimaryGeneratedColumn('identity') id: number;
 @Column({name:'strike_id',type:'integer',unique:true}) strikeId: number;
 @Column({type:'text'}) statement: string;
 @Column({type:'enum',enum:AppealStatus,enumName:'appeal_status',default:AppealStatus.PENDING}) status: AppealStatus;
 @Column({name:'decided_by',type:'integer',nullable:true}) decidedBy: number|null;
 @Column({name:'decision_reason',type:'text',nullable:true}) decisionReason: string|null;
 @Column({name:'decided_at',type:'timestamptz',nullable:true}) decidedAt: Date|null;
 @CreateDateColumn({name:'created_at',type:'timestamptz'}) createdAt: Date;
 @UpdateDateColumn({name:'updated_at',type:'timestamptz'}) updatedAt: Date;
}
