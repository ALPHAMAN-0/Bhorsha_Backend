import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { StrikesService } from './strikes.service.js';
import type { AuthRequest } from './support-auth.js';
import { principal, officer } from './support-auth.js';
import { auditContext } from './request-context.js';
import { AppealsService } from './appeals.service.js';
@Controller('strikes')
export class StrikesController {
 constructor(private readonly service:StrikesService,private readonly appeals:AppealsService){}
 @Post() create(@Req() req:AuthRequest,@Body() body:Record<string,unknown>){const u=principal(req);return this.service.create(u,auditContext(req,u),body);}
 @Get() list(@Req() req:AuthRequest,@Query() q:Record<string,unknown>){officer(principal(req));return this.service.list(q);}
 @Get(':id') one(@Req() req:AuthRequest,@Param('id',ParseIntPipe) id:number){return this.service.one(principal(req),id);}
 @Patch(':id') update(@Req() req:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() body:Record<string,unknown>){const u=principal(req);return this.service.update(u,auditContext(req,u),id,body);}
 @Delete(':id') revoke(@Req() req:AuthRequest,@Param('id',ParseIntPipe) id:number){const u=principal(req);return this.service.revoke(u,auditContext(req,u),id);}
 @Post(':id/appeals') appeal(@Req() req:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() body:Record<string,unknown>){const u=principal(req);return this.appeals.submit(u,auditContext(req,u),id,body);}
}
