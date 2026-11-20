import { Module } from '@nestjs/common';
import { NotifyModule } from '../notify/notify.module.js';
import { TripsModule } from '../trips/trips.module.js';
import { SafetyController } from './safety.controller.js';
import { SafetyService } from './safety.service.js';

/**
 * SOS alerts (README section 8: the safety module). The course database has
 * no sos_events table, so each alert is emailed to the safety inbox.
 */
@Module({
  imports: [
    TripsModule, // RidesService.findOne: the sender must be on the ride
    NotifyModule, // the alert email
  ],
  controllers: [SafetyController],
  providers: [SafetyService],
})
export class SafetyModule {}
