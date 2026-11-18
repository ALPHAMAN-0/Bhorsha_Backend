import { AuditContext } from '../audit/audit-logs.service.js';
import { AuthRequest, Principal } from './support-auth.js';
export function auditContext(req:AuthRequest,u:Principal):AuditContext {
  return {userId:u.id,requestId:req.requestId,ip:req.ip};
}
