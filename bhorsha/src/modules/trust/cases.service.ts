
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
  ownOrOfficer,
  officer,
} from '../../common/guards/support-auth.js';
import {
  positiveId,
  optionalId,
  nonempty,
  oneOf,
  tkAsPaisa,
  limitOf,
} from '../../common/input.js';
import { paisaToTk } from '../../common/money.js';
import {
  CaseType,
  CaseStatus,
} from './entities/support-case.entity.js';
import { lockCase } from './locks.js';

const types = Object.values(CaseType);
const statuses = Object.values(CaseStatus);

/**
 * A support case as the API shows it: the database's amount_claimed_paisa becomes amount_claimed_tk
 * (same position in the row). Audit logs keep the raw database row.
 */
function caseView(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) =>
      key === 'amount_claimed_paisa'
        ? ['amount_claimed_tk', value === null ? null : paisaToTk(value as string)]
        : [key, value],
    ),
  );
}

@Injectable()
export class CasesService {
  constructor(
    private readonly db: DataSource,
    private readonly audit: AuditLogsService,
  ) {}

  async create(
    u: Principal,
    ctx: AuditContext,
    body: Record<string, unknown>,
  ) {
    const type = oneOf(body.type, types, 'type');
    const description = nonempty(body.description, 'description');
    const subjectId = optionalId(body.subjectId, 'subjectId');
    const rideId = optionalId(body.rideId, 'rideId');
    const amount = tkAsPaisa(body.amountClaimedTk);

    if (subjectId === u.id) {
      throw new BadRequestException('Cannot report yourself');
    }

    if (type === 'OVERCHARGE' && amount === null) {
      throw new BadRequestException(
        'Overcharge needs amountClaimedTk',
      );
    }

    if (type !== 'OVERCHARGE' && amount !== null) {
      throw new BadRequestException('Amount only for OVERCHARGE');
    }

    return this.db.transaction(async (m) => {
      const [row] = await m.query(
        `INSERT INTO support_cases
        (type, reporter_id, subject_id, ride_id, description, amount_claimed_paisa)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [type, u.id, subjectId, rideId, description, amount],
      );

      await this.audit.record(
        m,
        ctx,
        'CASE_CREATED',
        'support_cases',
        row.id,
        null,
        row,
      );

      return caseView(row);
    });
  }

  async list(q: Record<string, unknown>) {
    const args: unknown[] = [];
    let where = '';

    if (q.status !== undefined) {
      args.push(oneOf(q.status, statuses, 'status'));
      where = 'WHERE status=$1';
    }

    args.push(limitOf(q.limit));

    const rows: Record<string, unknown>[] = await this.db.query(
      `SELECT * FROM support_cases ${where}
       ORDER BY id DESC LIMIT $${args.length}`,
      args,
    );
    return rows.map(caseView);
  }

  async one(u: Principal, id: number) {
    const [row] = await this.db.query(
      'SELECT * FROM support_cases WHERE id=$1',
      [id],
    );

    if (!row) {
      throw new NotFoundException('Case not found');
    }

    ownOrOfficer(u, row.reporter_id);

    return caseView(row);
  }

  async update(
    u: Principal,
    ctx: AuditContext,
    id: number,
    body: Record<string, unknown>,
  ) {
    officer(u);

    const allowed = ['assignedTo', 'status', 'resolution'];

    if (
      Object.keys(body).some((k) => !allowed.includes(k)) ||
      !Object.keys(body).length
    ) {
      throw new BadRequestException(
        'Only assignedTo, status and resolution are editable',
      );
    }

    return this.db.transaction(async (m) => {
      const old = await lockCase(m, id);

      if (['UPHELD', 'DISMISSED', 'WITHDRAWN'].includes(old.status)) {
        throw new ConflictException('Case already closed');
      }

      const status =
        body.status === undefined
          ? old.status
          : oneOf(body.status, statuses, 'status');

      const transitions: Record<string, string[]> = {
        OPEN: [
          'OPEN',
          'UNDER_REVIEW',
          'UPHELD',
          'DISMISSED',
          'WITHDRAWN',
        ],
        UNDER_REVIEW: [
          'UNDER_REVIEW',
          'UPHELD',
          'DISMISSED',
          'WITHDRAWN',
        ],
      };

      if (!transitions[old.status]?.includes(status)) {
        throw new ConflictException(
          'Invalid case status transition',
        );
      }

      const assigned =
        body.assignedTo === undefined
          ? old.assigned_to
          : positiveId(body.assignedTo, 'assignedTo');

      const resolution =
        body.resolution === undefined
          ? old.resolution
          : nonempty(body.resolution, 'resolution');

      const final = ['UPHELD', 'DISMISSED'].includes(status);

      if (final && (!assigned || !resolution)) {
        throw new BadRequestException(
          'Resolved case needs assignedTo and resolution',
        );
      }

      // TypeORM PostgreSQL UPDATE RETURNING result: [rows, affectedCount]
      const result = await m.query(
        `UPDATE support_cases
         SET assigned_to=$2,
             status=$3,
             resolution=$4,
             resolved_at=$5
         WHERE id=$1
         RETURNING *`,
        [
          id,
          assigned,
          status,
          resolution,
          final ? new Date() : null,
        ],
      );

      const row = result[0][0];

      await this.audit.record(
        m,
        ctx,
        'CASE_UPDATED',
        'support_cases',
        id,
        old,
        row,
      );

      return caseView(row);
    });
  }

  async withdraw(
    u: Principal,
    ctx: AuditContext,
    id: number,
  ) {
    return this.db.transaction(async (m) => {
      const old = await lockCase(m, id);

      ownOrOfficer(u, old.reporter_id);

      if (!['OPEN', 'UNDER_REVIEW'].includes(old.status)) {
        throw new ConflictException(
          'Case cannot be withdrawn',
        );
      }

      // Correctly extract the updated row from TypeORM's result
      const result = await m.query(
        `UPDATE support_cases
         SET status='WITHDRAWN'
         WHERE id=$1
         RETURNING *`,
        [id],
      );

      const row = result[0][0];

      await this.audit.record(
        m,
        ctx,
        'CASE_WITHDRAWN',
        'support_cases',
        id,
        old,
        row,
      );

      return caseView(row);
    });
  }
}
