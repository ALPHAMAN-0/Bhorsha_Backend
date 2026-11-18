import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { CasesService } from './cases.service.js';
import type { AuthRequest } from './support-auth.js';
import { principal, officer } from './support-auth.js';
import { auditContext } from './request-context.js';
@Controller('cases')
export class CasesController {
 constructor(private readonly service:CasesService){}
 @Post() create(@Req() req:AuthRequest,@Body() body:Record<string,unknown>){const u=principal(req);return this.service.create(u,auditContext(req,u),body);}
 @Get() list(@Req() req:AuthRequest,@Query() query:Record<string,unknown>){officer(principal(req));return this.service.list(query);}
 @Get(':id') one(@Req() req:AuthRequest,@Param('id',ParseIntPipe) id:number){return this.service.one(principal(req),id);}
 @Patch(':id') update(@Req() req:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() body:Record<string,unknown>){const u=principal(req);return this.service.update(u,auditContext(req,u),id,body);}
 @Delete(':id') withdraw(@Req() req:AuthRequest,@Param('id',ParseIntPipe) id:number){const u=principal(req);return this.service.withdraw(u,auditContext(req,u),id);}
}
