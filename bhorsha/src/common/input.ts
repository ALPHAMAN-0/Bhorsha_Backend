import { BadRequestException, ParseIntPipe } from '@nestjs/common';
import { MAX_TK, tkToPaisa } from './money.js';
export function positiveId(value: unknown, field = 'id'): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new BadRequestException(`${field} must be a positive integer`);
  return n;
}
export function nonempty(value: unknown, field: string, max = 4000): string {
  if (typeof value !== 'string' || value.trim().length < 1 || value.length > max) {
    throw new BadRequestException(`${field} must be 1-${max} characters`);
  }
  return value.trim();
}
export function optionalId(value: unknown, field: string): number | null {
  return value === undefined || value === null ? null : positiveId(value, field);
}
export function oneOf<T extends string>(value: unknown, values: readonly T[], field: string): T {
  if (!values.includes(value as T)) throw new BadRequestException(`${field} must be one of ${values.join(', ')}`);
  return value as T;
}
export function limitOf(value: unknown, maximum = 100): number {
  if (value === undefined) return 20;
  const n = positiveId(value, 'limit');
  if (n > maximum) throw new BadRequestException(`limit must be at most ${maximum}`);
  return n;
}
/** Reads a Tk amount (up to 2 decimals) from the request and returns it as paisa for the bigint column. */
export function tkAsPaisa(value: unknown, field = 'amountClaimedTk'): string | null {
  if (value === undefined || value === null) return null;
  // Above 0, as ck_support_cases_amount_claimed requires.
  if (!(typeof value === 'string' || typeof value === 'number') || !/^\d+(\.\d{1,2})?$/.test(String(value)) || Number(value) <= 0 || Number(value) > MAX_TK) {
    throw new BadRequestException(`${field} must be a Tk amount above 0 with at most 2 decimals`);
  }
  return String(tkToPaisa(Number(value)));
}
/**
 * The JSON body of an endpoint that takes a plain object instead of a DTO (the support endpoints).
 * The global ValidationPipe can't check those, so this does what it does for DTOs: a missing body
 * counts as {} (Express 5 leaves req.body undefined), and a field the endpoint doesn't take is a 400.
 */
export function jsonBody(body: unknown, allowed: readonly string[]): Record<string, unknown> {
  const value = body ?? {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('The request body must be a JSON object');
  }
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extra.length > 0) {
    throw new BadRequestException(`Unknown field ${extra.join(', ')}: send only ${allowed.join(', ')}`);
  }
  return value as Record<string, unknown>;
}
export function futureDate(value: unknown, field = 'expiresAt'): Date {
  const date = new Date(String(value));
  if (!value || isNaN(date.getTime()) || date.getTime() <= Date.now()) throw new BadRequestException(`${field} must be a future ISO date`);
  return date;
}
