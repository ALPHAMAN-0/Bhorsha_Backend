import { NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

/**
 * Locks a support case or a strike for the rest of the transaction
 * (SELECT ... FOR UPDATE) and returns the row, or answers 404.
 */
export async function lockCase(m: EntityManager, id: number) {
  const [row] = await m.query('SELECT * FROM support_cases WHERE id=$1 FOR UPDATE', [id]);
  if (!row) {
    throw new NotFoundException('Case not found');
  }
  return row;
}

export async function lockStrike(m: EntityManager, id: number) {
  const [row] = await m.query('SELECT * FROM strikes WHERE id=$1 FOR UPDATE', [id]);
  if (!row) {
    throw new NotFoundException('Strike not found');
  }
  return row;
}
