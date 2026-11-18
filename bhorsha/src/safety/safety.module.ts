import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SosEvent } from './entities/sos-event.entity.js';
import { SafetyService } from './safety.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([SosEvent])],
  providers: [SafetyService],
  exports: [SafetyService, TypeOrmModule],
})
export class SafetyModule {}
