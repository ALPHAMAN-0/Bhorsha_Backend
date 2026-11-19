import { Module } from '@nestjs/common';
import { SafetyService } from './safety.service.js';

// No entities: DB v2 has no SOS table. An SOS is emailed (NotifyModule is global).
@Module({
  providers: [SafetyService],
  exports: [SafetyService],
})
export class SafetyModule {}
