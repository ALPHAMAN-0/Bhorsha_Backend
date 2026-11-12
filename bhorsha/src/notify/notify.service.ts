import { Injectable, Logger } from '@nestjs/common';
import * as net from 'node:net';

export interface EmailDispatchOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  priority?: 'high' | 'normal';
}

@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);
  private readonly host = process.env.MAIL_HOST || 'localhost';
  private readonly port = Number(process.env.MAIL_PORT) || 1025;
  private readonly from = process.env.MAIL_FROM || 'emergency@bhorsha.com';

  async sendEmail(opts: EmailDispatchOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const client = new net.Socket();
      let step = 0;
      let finished = false;

      const finish = (ok: boolean) => {
        if (!finished) {
          finished = true;
          try {
            client.destroy();
          } catch {}
          resolve(ok);
        }
      };

      client.setTimeout(3000);
      client.on('timeout', () => {
        this.logger.warn(`SMTP connection timed out to ${this.host}:${this.port}`);
        finish(false);
      });

      client.on('error', (err) => {
        this.logger.warn(`SMTP delivery error (${this.host}:${this.port}): ${err.message}`);
        finish(false);
      });

      client.connect(this.port, this.host, () => {
        // Connected to Mailpit SMTP
      });

      client.on('data', (data) => {
        const msg = data.toString();
        const code = msg.substring(0, 3);

        if (step === 0 && code === '220') {
          step = 1;
          client.write(`HELO bhorsha.local\r\n`);
        } else if (step === 1 && code === '250') {
          step = 2;
          client.write(`MAIL FROM:<${this.from}>\r\n`);
        } else if (step === 2 && code === '250') {
          step = 3;
          client.write(`RCPT TO:<${opts.to}>\r\n`);
        } else if (step === 3 && code === '250') {
          step = 4;
          client.write(`DATA\r\n`);
        } else if (step === 4 && code === '354') {
          step = 5;
          const body = [
            `From: "Bhorsha Safety Desk" <${this.from}>`,
            `To: <${opts.to}>`,
            `Subject: ${opts.subject}`,
            `X-Priority: ${opts.priority === 'high' ? '1 (Highest)' : '3 (Normal)'}`,
            `MIME-Version: 1.0`,
            `Content-Type: text/html; charset=UTF-8`,
            ``,
            opts.html,
            `.`,
            ``,
          ].join('\r\n');
          client.write(body);
        } else if (step === 5 && code === '250') {
          step = 6;
          client.write(`QUIT\r\n`);
          this.logger.log(`[SMTP] Successfully delivered email "${opts.subject}" to ${opts.to}`);
          finish(true);
        }
      });
    });
  }
}
