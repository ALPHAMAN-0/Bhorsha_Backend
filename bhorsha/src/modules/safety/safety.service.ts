import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { NotifyService } from '../notify/notify.service.js';

const SAFETY_INBOX = 'safety-operations@bhorsha.com';

/** The ride an SOS is about. The caller has already checked the sender is on it. */
export interface SosRide {
  id: number;
  status: string;
  driver_id: number | null;
}

export interface SosAlert {
  status: 'SENT';
  user_id: number;
  ride_id: number | null;
  lat: number | null;
  lng: number | null;
  sent_to: string;
  sent_at: string;
}

/**
 * SOS alerts (FR-18). DB v2 has no SOS table: each alert is emailed to the
 * safety inbox, so the email is the record. If it cannot be delivered, the
 * caller gets a 503 instead of a false "sent".
 */
@Injectable()
export class SafetyService {
  private readonly logger = new Logger(SafetyService.name);

  constructor(private readonly notifyService: NotifyService) {}

  async triggerSos(
    userId: number,
    ride: SosRide | null,
    lat?: number,
    lng?: number,
  ): Promise<SosAlert> {
    const sentAt = new Date();
    const dhakaTime = sentAt.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' });
    const rideLabel = ride ? `#${ride.id}` : 'N/A';

    this.logger.warn(
      `🚨 [SOS TRIGGERED] User #${userId} on Ride ${rideLabel} at [${lat ?? 'N/A'}, ${lng ?? 'N/A'}]`,
    );

    const rideRows = ride
      ? `
            <tr><td style="padding: 6px; font-weight: bold;">Ride status:</td><td style="padding: 6px;">${ride.status}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Driver ID:</td><td style="padding: 6px;">${ride.driver_id === null ? 'Not assigned' : `#${ride.driver_id}`}</td></tr>`
      : '';

    const delivered = await this.notifyService.sendEmail({
      to: SAFETY_INBOX,
      subject: `🚨 [CRITICAL SOS] Emergency alert from User #${userId} (Ride ${rideLabel})`,
      priority: 'high',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 3px solid #d9534f; border-radius: 8px;">
          <h2 style="color: #d9534f; margin-top: 0;">🚨 BHORSHA EMERGENCY DISPATCH ALERT</h2>
          <p>An emergency SOS distress signal was triggered from the passenger application:</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr><td style="padding: 6px; font-weight: bold; width: 140px;">User ID:</td><td style="padding: 6px;">#${userId}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Ride ID:</td><td style="padding: 6px;">${rideLabel}</td></tr>${rideRows}
            <tr><td style="padding: 6px; font-weight: bold;">Coordinates:</td><td style="padding: 6px;">${lat ?? 'N/A'}, ${lng ?? 'N/A'}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Timestamp (Dhaka):</td><td style="padding: 6px;">${dhakaTime}</td></tr>
          </table>
          <div style="margin-top: 15px; padding: 10px; background-color: #f9f2f4; border-left: 4px solid #d9534f;">
            <strong>Immediate Protocol:</strong> Emergency control center notified. 999 Police dispatch bridge alerted.
          </div>
        </div>
      `,
    });

    if (!delivered) {
      this.logger.error(`SOS from user #${userId} (Ride ${rideLabel}) could not be emailed`);
      throw new ServiceUnavailableException(
        'The SOS alert could not be sent. Try again, or call 999.',
      );
    }

    return {
      status: 'SENT',
      user_id: userId,
      ride_id: ride?.id ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      sent_to: SAFETY_INBOX,
      sent_at: sentAt.toISOString(),
    };
  }
}
