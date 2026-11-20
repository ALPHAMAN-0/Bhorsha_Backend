import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CasesService } from './cases.service.js';
import type { AuthRequest } from './support-auth.js';
import { principal, officer } from './support-auth.js';
import { auditContext } from './request-context.js';
import { CASE_STATUS_QUERY, CREATE_CASE_BODY, LIMIT_QUERY, UPDATE_CASE_BODY, UPDATE_CASE_EXAMPLES } from './api-docs.js';
@ApiTags('Support Domain')
@Controller('cases')
export class CasesController {
 constructor(private readonly service:CasesService){}
 @ApiOperation({ summary: 'Open a support case (any logged-in user)', description: 'OVERCHARGE needs amountClaimedTk; the other types must leave it out.' })
 @ApiBody({ schema: CREATE_CASE_BODY })
 @Post() create(@Req() req:AuthRequest,@Body() body:Record<string,unknown>){const u=principal(req);return this.service.create(u,auditContext(req,u),body);}
 @ApiOperation({ summary: 'Case queue, newest first (Support / Admin)' })
 @ApiQuery(CASE_STATUS_QUERY)
 @ApiQuery(LIMIT_QUERY)
 @Get() list(@Req() req:AuthRequest,@Query() query:Record<string,unknown>){officer(principal(req));return this.service.list(query);}
 @ApiOperation({ summary: 'One case (its reporter, or Support / Admin)' })
 @Get(':id') one(@Req() req:AuthRequest,@Param('id',ParseIntPipe) id:number){return this.service.one(principal(req),id);}
 @ApiOperation({ summary: 'Assign, review, uphold or dismiss a case (Support / Admin)', description: 'A closed case (UPHELD, DISMISSED, WITHDRAWN) can no longer change: 409.' })
 @ApiBody({ schema: UPDATE_CASE_BODY, examples: UPDATE_CASE_EXAMPLES })
 @Patch(':id') update(@Req() req:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() body:Record<string,unknown>){const u=principal(req);return this.service.update(u,auditContext(req,u),id,body);}
 @ApiOperation({ summary: 'Withdraw a case (its reporter, or Support / Admin)', description: 'Only an OPEN or UNDER_REVIEW case; the case becomes WITHDRAWN.' })
 @Delete(':id') withdraw(@Req() req:AuthRequest,@Param('id',ParseIntPipe) id:number){const u=principal(req);return this.service.withdraw(u,auditContext(req,u),id);}
}
