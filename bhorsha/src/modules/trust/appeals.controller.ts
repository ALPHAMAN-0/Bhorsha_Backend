import { Body, Controller, Param, ParseIntPipe, Patch, Req } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppealsService } from './appeals.service.js';
import type { AuthRequest } from '../../common/guards/support-auth.js';
import { principal } from '../../common/guards/support-auth.js';
import { auditContext } from './request-context.js';
import { DECIDE_APPEAL_BODY } from './api-docs.js';
@ApiTags('Support Domain')
@Controller('appeals')
export class AppealsController {
 constructor(private readonly service:AppealsService){}
 @ApiOperation({ summary: 'Accept or reject an appeal (Support / Admin, not the issuing officer)', description: 'ACCEPTED overturns the strike. The officer who issued the strike, and the struck user, get 403.' })
 @ApiBody({ schema: DECIDE_APPEAL_BODY })
 @Patch(':id') decide(@Req() req:AuthRequest,@Param('id',ParseIntPipe) id:number,@Body() body:Record<string,unknown>){const u=principal(req);return this.service.decide(u,auditContext(req,u),id,body);}
}
