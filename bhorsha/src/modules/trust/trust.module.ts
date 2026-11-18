import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module.js';
import { SupportCase } from './entities/support-case.entity.js';
import { Strike } from './entities/strike.entity.js';
import { Appeal } from './entities/appeal.entity.js';
import { CasesController } from './cases.controller.js';
import { CasesService } from './cases.service.js';
import { StrikesController } from './strikes.controller.js';
import { StrikesService } from './strikes.service.js';
import { AppealsController } from './appeals.controller.js';
import { AppealsService } from './appeals.service.js';
@Module({
 imports: [TypeOrmModule.forFeature([SupportCase, Strike, Appeal]), AuditModule],
 controllers: [CasesController, StrikesController, AppealsController],
 providers: [CasesService, StrikesService, AppealsService],
})
export class TrustModule {}
