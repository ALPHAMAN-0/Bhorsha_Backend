import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service.js';
import type { AuthRequest } from '../trust/support-auth.js';
import { officer, principal } from '../trust/support-auth.js';
@Controller('audit-logs')
export class AuditLogsController {
 constructor(private readonly service: AuditLogsService) {}
 @Get() list(@Req() req: AuthRequest, @Query() q: Record<string, unknown>) {officer(principal(req));return this.service.list(q);}
 @Get(':id') one(@Req() req: AuthRequest, @Param('id') id: string) {officer(principal(req));return this.service.one(id);}
}
