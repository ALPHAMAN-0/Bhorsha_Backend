import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
@Entity('audit_logs')
export class AuditLog {
 @PrimaryGeneratedColumn('identity',{type:'bigint'}) id: string;
 @Column({name:'user_id',type:'integer',nullable:true}) userId: number|null;
 @Column({type:'varchar',length:100}) action: string;
 @Column({type:'varchar'}) entity: string;
 @Column({name:'entity_id',type:'varchar',nullable:true}) entityId: string|null;
 @Column({name:'old_value',type:'jsonb',nullable:true}) oldValue: object|null;
 @Column({name:'new_value',type:'jsonb',nullable:true}) newValue: object|null;
 @Column({name:'ip_address',type:'inet',nullable:true}) ipAddress: string|null;
 @Column({name:'request_id',type:'varchar',length:64,nullable:true}) requestId: string|null;
 @CreateDateColumn({name:'created_at',type:'timestamptz'}) createdAt: Date;
}
