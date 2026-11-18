import { Body, Controller, Param, ParseIntPipe, Patch, Req } from '@nestjs/common';
import { AppealsService } from './appeals.service.js';
import type { AuthRequest } from './support-auth.js';
import { principal } from './support-auth.js';
import { auditContext } from './request-context.js';
@Controller('appeals')
export class AppealsController {
 constructor(private readonly service:AppealsService){}
 @Patch(':id') decide(@Req() req:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() body:Record<string,unknown>){const u=principal(req);return this.service.decide(u,auditContext(req,u),id,body);}
}
