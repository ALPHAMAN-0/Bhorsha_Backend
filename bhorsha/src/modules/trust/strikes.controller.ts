import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { StrikesService } from './strikes.service.js';
import type { AuthRequest } from '../../common/guards/support-auth.js';
import { principal, officer } from '../../common/guards/support-auth.js';
import { auditContext } from './request-context.js';
import { AppealsService } from './appeals.service.js';
import { LIMIT_QUERY } from '../../common/dto/page.js';
import { APPEAL_BODY, CREATE_STRIKE_BODY, STRIKE_STATUS_QUERY, UPDATE_STRIKE_BODY } from './api-docs.js';
@ApiTags('Support Domain')
@Controller('strikes')
export class StrikesController {
 constructor(private readonly service:StrikesService,private readonly appeals:AppealsService){}
 @ApiOperation({ summary: 'Issue a strike from an UPHELD case against its subject (Support / Admin)', description: 'The strike expires in 90 days. 409 if the case is not UPHELD, userId is not its subject, or the case already has a live strike.' })
 @ApiBody({ schema: CREATE_STRIKE_BODY })
 @Post() create(@Req() req:AuthRequest,@Body() body:Record<string,unknown>){const u=principal(req);return this.service.create(u,auditContext(req,u),body);}
 @ApiOperation({ summary: 'List strikes, newest first (Support / Admin)' })
 @ApiQuery({ name: 'userId', required: false, type: Number, description: 'Only this user\'s strikes' })
 @ApiQuery(STRIKE_STATUS_QUERY)
 @ApiQuery(LIMIT_QUERY)
 @Get() list(@Req() req:AuthRequest,@Query() q:Record<string,unknown>){officer(principal(req));return this.service.list(q);}
 @ApiOperation({ summary: 'One strike (the struck user, or Support / Admin)' })
 @Get(':id') one(@Req() req:AuthRequest,@Param('id',ParseIntPipe) id:number){return this.service.one(principal(req),id);}
 @ApiOperation({ summary: "Change an ACTIVE strike's reason or expiry (Support / Admin)" })
 @ApiBody({ schema: UPDATE_STRIKE_BODY })
 @Patch(':id') update(@Req() req:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() body:Record<string,unknown>){const u=principal(req);return this.service.update(u,auditContext(req,u),id,body);}
 @ApiOperation({ summary: 'Revoke an ACTIVE strike (Support / Admin)', description: 'The strike becomes REVOKED; nothing is deleted.' })
 @Delete(':id') revoke(@Req() req:AuthRequest,@Param('id',ParseIntPipe) id:number){const u=principal(req);return this.service.revoke(u,auditContext(req,u),id);}
 @ApiOperation({ summary: 'Appeal your own ACTIVE strike (the struck user)', description: 'One appeal per strike: a second one is 409.' })
 @ApiBody({ schema: APPEAL_BODY })
 @Post(':id/appeals') appeal(@Req() req:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() body:Record<string,unknown>){const u=principal(req);return this.appeals.submit(u,auditContext(req,u),id,body);}
}
