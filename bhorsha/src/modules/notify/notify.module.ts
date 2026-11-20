import { Module } from '@nestjs/common';
import { NotifyService } from './notify.service.js';

/** Sends email over SMTP (Mailpit in development). TripsModule uses it for SOS alerts. */
@Module({
  providers: [NotifyService],
  exports: [NotifyService],
})
export class NotifyModule {}
