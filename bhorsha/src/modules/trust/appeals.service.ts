import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditLogsService, AuditContext } from '../audit/audit-logs.service.js';
import { Principal, officer } from './support-auth.js';
import { nonempty, oneOf } from './input.js';
@Injectable()
export class AppealsService {
 constructor(private readonly db:DataSource,private readonly audit:AuditLogsService){}
 async submit(u:Principal,ctx:AuditContext,strikeId:number,body:Record<string,unknown>){
  const statement=nonempty(body.statement,'statement');
  return this.db.transaction(async m=>{
   const [strike]=await m.query('SELECT * FROM strikes WHERE id=$1 FOR UPDATE',[strikeId]);if(!strike)throw new NotFoundException('Strike not found');
   if(strike.user_id!==u.id)throw new ForbiddenException('Only the struck user can appeal');
   if(strike.status!=='ACTIVE')throw new ConflictException('Strike is not active');
   const [row]=await m.query('INSERT INTO appeals(strike_id,statement) VALUES($1,$2) RETURNING *',[strikeId,statement]);
   await this.audit.record(m,ctx,'APPEAL_SUBMITTED','appeals',row.id,null,row);return row;
  });
 }
 async decide(u:Principal,ctx:AuditContext,id:number,body:Record<string,unknown>){officer(u);
  const status=oneOf(body.status,['ACCEPTED','REJECTED'] as const,'status');const reason=nonempty(body.decisionReason,'decisionReason');
  return this.db.transaction(async m=>{
   const [old]=await m.query(`SELECT a.*,s.user_id,s.issued_by,s.status AS strike_status FROM appeals a JOIN strikes s ON s.id=a.strike_id WHERE a.id=$1 FOR UPDATE OF a,s`,[id]);
   if(!old)throw new NotFoundException('Appeal not found');if(old.status!=='PENDING')throw new ConflictException('Appeal already decided');
   if(old.issued_by===u.id||old.user_id===u.id)throw new ForbiddenException('Issuer or struck user cannot decide this appeal');
   const [row]=await m.query('UPDATE appeals SET status=$2,decided_by=$3,decision_reason=$4,decided_at=now() WHERE id=$1 RETURNING *',[id,status,u.id,reason]);
   if(status==='ACCEPTED'){
    if(old.strike_status!=='ACTIVE')throw new ConflictException('Strike no longer active');
    const [before]=await m.query('SELECT * FROM strikes WHERE id=$1 FOR UPDATE',[old.strike_id]);
    const [after]=await m.query(`UPDATE strikes SET status='OVERTURNED' WHERE id=$1 RETURNING *`,[old.strike_id]);
    await this.audit.record(m,ctx,'STRIKE_OVERTURNED','strikes',old.strike_id,before,after);
   }
   const {user_id,issued_by,strike_status,...appealBefore}=old;
   await this.audit.record(m,ctx,'APPEAL_DECIDED','appeals',id,appealBefore,row);return row;
  });
 }
}
