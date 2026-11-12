import { Module } from '@nestjs/common';
import { CasesController } from './cases.controller.js';
import { CasesService } from './cases.service.js';
import { StrikesController } from './strikes.controller.js';
import { StrikesService } from './strikes.service.js';
import { AppealsController } from './appeals.controller.js';
import { AppealsService } from './appeals.service.js';

@Module({
  controllers: [CasesController, StrikesController, AppealsController],
  providers: [CasesService, StrikesService, AppealsService]
})
export class TrustModule {}
