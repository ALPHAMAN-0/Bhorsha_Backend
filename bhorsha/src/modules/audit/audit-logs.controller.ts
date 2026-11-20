import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service.js';
import type { AuthRequest } from '../../common/guards/support-auth.js';
import { officer, principal } from '../../common/guards/support-auth.js';
import { LIMIT_QUERY } from '../../common/dto/page.js';
@ApiTags('Support Domain')
@Controller('audit-logs')
export class AuditLogsController {
 constructor(private readonly service: AuditLogsService) {}
 @ApiOperation({ summary: 'Audit trail, newest first (Support / Admin)', description: 'For the next page, pass the smallest id you got as cursor.' })
 @ApiQuery({ name: 'userId', required: false, type: Number, description: 'Who made the change' })
 @ApiQuery({ name: 'entity', required: false, type: String, description: 'Table name, e.g. support_cases, strikes or appeals', example: 'strikes' })
 @ApiQuery({ name: 'from', required: false, type: String, description: 'ISO date or date-time, inclusive', example: '2026-11-01' })
 @ApiQuery({ name: 'to', required: false, type: String, description: 'ISO date or date-time, inclusive' })
 @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Only entries with a smaller id' })
 @ApiQuery(LIMIT_QUERY)
 @Get() list(@Req() req: AuthRequest, @Query() q: Record<string, unknown>) {officer(principal(req));return this.service.list(q);}
 @ApiOperation({ summary: 'One audit entry with its old and new values (Support / Admin)' })
 @Get(':id') one(@Req() req: AuthRequest, @Param('id') id: string) {officer(principal(req));return this.service.one(id);}
}
