
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  AuditLogsService,
  type AuditContext,
} from '../audit/audit-logs.service.js';
import {
  type Principal,
  officer,
  ownOrOfficer,
} from './support-auth.js';
import {
  positiveId,
  nonempty,
  oneOf,
  limitOf,
  futureDate,
} from './input.js';
import { StrikeStatus } from './entities/strike.entity.js';

@Injectable()
export class StrikesService {
  constructor(
    private readonly db: DataSource,
    private readonly audit: AuditLogsService,
  ) {}

  async create(
    u: Principal,
    ctx: AuditContext,
    body: Record<string, unknown>,
  ) {
    officer(u);

    const caseId = positiveId(body.caseId, 'caseId');
    const userId = positiveId(body.userId, 'userId');
    const reason = nonempty(body.reason, 'reason');

    if (userId === u.id) {
      throw new BadRequestException(
        'Cannot issue strike to yourself',
      );
    }

    return this.db.transaction(async (m) => {
      const [c] = await m.query(
        'SELECT * FROM support_cases WHERE id=$1 FOR UPDATE',
        [caseId],
      );

      if (!c) {
        throw new NotFoundException('Case not found');
      }

      if (c.status !== 'UPHELD') {
        throw new ConflictException(
          'Strike requires an upheld case',
        );
      }

      if (c.subject_id !== userId) {
        throw new ConflictException(
          'Strike must name the case subject',
        );
      }

      const [row] = await m.query(
        `INSERT INTO strikes
         (user_id, case_id, issued_by, reason, issued_at, expires_at)
         VALUES ($1, $2, $3, $4, now(), now() + interval '90 days')
         RETURNING *`,
        [userId, caseId, u.id, reason],
      );

      await this.audit.record(
        m,
        ctx,
        'STRIKE_ISSUED',
        'strikes',
        row.id,
        null,
        row,
      );

      return row;
    });
  }

  async list(q: Record<string, unknown>) {
    const args: unknown[] = [];
    const where: string[] = [];

    if (q.userId !== undefined) {
      args.push(positiveId(q.userId, 'userId'));
      where.push(`user_id=$${args.length}`);
    }

    if (q.status !== undefined) {
      args.push(
        oneOf(q.status, Object.values(StrikeStatus), 'status'),
      );
      where.push(`status=$${args.length}`);
    }

    args.push(limitOf(q.limit));

    return this.db.query(
      `SELECT * FROM strikes
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY id DESC LIMIT $${args.length}`,
      args,
    );
  }

  async one(u: Principal, id: number) {
    const [row] = await this.db.query(
      'SELECT * FROM strikes WHERE id=$1',
      [id],
    );

    if (!row) {
      throw new NotFoundException('Strike not found');
    }

    ownOrOfficer(u, row.user_id);

    return row;
  }

  async update(
    u: Principal,
    ctx: AuditContext,
    id: number,
    body: Record<string, unknown>,
  ) {
    officer(u);

    if (
      !Object.keys(body).length ||
      Object.keys(body).some(
        (k) => !['reason', 'expiresAt'].includes(k),
      )
    ) {
      throw new BadRequestException(
        'Only reason and expiresAt are editable',
      );
    }

    return this.db.transaction(async (m) => {
      const [old] = await m.query(
        'SELECT * FROM strikes WHERE id=$1 FOR UPDATE',
        [id],
      );

      if (!old) {
        throw new NotFoundException('Strike not found');
      }

      if (old.status !== 'ACTIVE') {
        throw new ConflictException(
          'Only active strikes can be edited',
        );
      }

      const reason =
        body.reason === undefined
          ? old.reason
          : nonempty(body.reason, 'reason');

      const expires =
        body.expiresAt === undefined
          ? old.expires_at
          : futureDate(body.expiresAt);

      if (
        new Date(expires).getTime() <=
        new Date(old.issued_at).getTime()
      ) {
        throw new BadRequestException(
          'Expiry must be after issue',
        );
      }

      // Fixed: extract the actual updated row
      const result = await m.query(
        `UPDATE strikes
         SET reason=$2, expires_at=$3
         WHERE id=$1
         RETURNING *`,
        [id, reason, expires],
      );

      const row = result[0][0];

      await this.audit.record(
        m,
        ctx,
        'STRIKE_UPDATED',
        'strikes',
        id,
        old,
        row,
      );

      return row;
    });
  }

  async revoke(
    u: Principal,
    ctx: AuditContext,
    id: number,
  ) {
    officer(u);

    return this.db.transaction(async (m) => {
      const [old] = await m.query(
        'SELECT * FROM strikes WHERE id=$1 FOR UPDATE',
        [id],
      );

      if (!old) {
        throw new NotFoundException('Strike not found');
      }

      if (old.status !== 'ACTIVE') {
        throw new ConflictException(
          'Only active strikes can be revoked',
        );
      }

      // Fixed: extract the actual revoked row
      const result = await m.query(
        `UPDATE strikes
         SET status='REVOKED', revoked_at=now()
         WHERE id=$1
         RETURNING *`,
        [id],
      );

      const row = result[0][0];

      await this.audit.record(
        m,
        ctx,
        'STRIKE_REVOKED',
        'strikes',
        id,
        old,
        row,
      );

      return row;
    });
  }
}
