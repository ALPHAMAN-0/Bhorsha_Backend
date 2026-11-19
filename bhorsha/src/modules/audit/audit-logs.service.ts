import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { limitOf, positiveId } from '../trust/input.js';
export interface AuditContext { userId: number; requestId?: string; ip?: string; }
@Injectable()
export class AuditLogsService {
  constructor(private readonly db: DataSource) {}
  // Call with the SAME transaction manager as the business change: audit and change commit together.
  async record(manager: EntityManager, context: AuditContext, action: string, entity: string, entityId: number, oldValue: object | null, newValue: object | null): Promise<void> {
    await manager.query(`INSERT INTO audit_logs (user_id,action,entity,entity_id,old_value,new_value,ip_address,request_id)
      VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::inet,$8)`,
      [context.userId,action,entity,String(entityId),oldValue ? JSON.stringify(oldValue) : null,newValue ? JSON.stringify(newValue) : null, context.ip ?? null,context.requestId ?? null]);
  }
  async list(q: Record<string,unknown>) {
    const conditions: string[]=[]; const args: unknown[]=[];
    const filter=(sql:string, value:unknown)=>{ if(value!==undefined){args.push(value);conditions.push(`${sql} = $${args.length}`);} };
    if(q.userId!==undefined) filter('user_id',positiveId(q.userId,'userId'));
    if(q.entity!==undefined) { if(typeof q.entity!=='string'||!/^\w{1,100}$/.test(q.entity)) throw new BadRequestException('Invalid entity'); filter('entity',q.entity); }
    if(q.from!==undefined) {const d=new Date(String(q.from));if(isNaN(d.getTime()))throw new BadRequestException('Invalid from'); args.push(d);conditions.push(`created_at >= $${args.length}`);}
    if(q.to!==undefined) {const d=new Date(String(q.to));if(isNaN(d.getTime()))throw new BadRequestException('Invalid to'); args.push(d);conditions.push(`created_at <= $${args.length}`);}
    if(q.cursor!==undefined){ const raw=String(q.cursor); if(!/^\d+$/.test(raw))throw new BadRequestException('Invalid cursor'); const n=BigInt(raw); if(n<=0n)throw new BadRequestException('Invalid cursor');args.push(n.toString());conditions.push(`id < $${args.length}`); }
    args.push(limitOf(q.limit));
    return this.db.query(`SELECT * FROM audit_logs ${conditions.length?'WHERE '+conditions.join(' AND '):''} ORDER BY id DESC LIMIT $${args.length}`,args);
  }
  async one(id: string) {if(!/^\d+$/.test(id)) throw new BadRequestException('Invalid id'); const [row]=await this.db.query('SELECT * FROM audit_logs WHERE id=$1',[id]);if(!row)throw new NotFoundException('Audit entry not found');return row;}
}
