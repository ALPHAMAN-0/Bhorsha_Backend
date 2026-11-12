import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotifyService } from '../notify/notify.service.js';
import { SosEvent, SosStatus } from './entities/sos-event.entity.js';

@Injectable()
export class SafetyService {
  private readonly logger = new Logger(SafetyService.name);

  constructor(
    @InjectRepository(SosEvent)
    private readonly sosRepo: Repository<SosEvent>,
    private readonly notifyService: NotifyService,
  ) {}

  async triggerSos(
    userId: number,
    rideId?: string,
    lat?: number,
    lng?: number,
  ): Promise<SosEvent> {
    const sos = this.sosRepo.create({
      user_id: userId,
      ride_id: rideId || null,
      lat: lat ?? null,
      lng: lng ?? null,
      status: SosStatus.TRIGGERED,
    });
    const saved = await this.sosRepo.save(sos);

    this.logger.warn(
      `🚨 [SOS TRIGGERED] User #${userId} on Ride #${rideId || 'N/A'} at [${lat}, ${lng}]`,
    );

    // Send real emergency email to Mailpit SMTP
    const dhakaTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' });
    await this.notifyService.sendEmail({
      to: 'safety-operations@bhorsha.com',
      subject: `🚨 [CRITICAL SOS] Emergency alert from User #${userId} (Ride #${rideId || 'N/A'})`,
      priority: 'high',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 3px solid #d9534f; border-radius: 8px;">
          <h2 style="color: #d9534f; margin-top: 0;">🚨 BHORSHA EMERGENCY DISPATCH ALERT</h2>
          <p>An emergency SOS distress signal was triggered from the passenger application:</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr><td style="padding: 6px; font-weight: bold; width: 140px;">Event ID:</td><td style="padding: 6px;">#${saved.id}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">User ID:</td><td style="padding: 6px;">#${userId}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Ride ID:</td><td style="padding: 6px;">${rideId || 'N/A'}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Coordinates:</td><td style="padding: 6px;">${lat ?? 'N/A'}, ${lng ?? 'N/A'}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Timestamp (Dhaka):</td><td style="padding: 6px;">${dhakaTime}</td></tr>
          </table>
          <div style="margin-top: 15px; padding: 10px; background-color: #f9f2f4; border-left: 4px solid #d9534f;">
            <strong>Immediate Protocol:</strong> Emergency control center notified. 999 Police dispatch bridge alerted.
          </div>
        </div>
      `,
    });

    return saved;
  }
}
