import { BadRequestException, ParseIntPipe } from '@nestjs/common';
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
export function paisa(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (!(typeof value === 'string' || typeof value === 'number') || !/^\d+$/.test(String(value))) throw new BadRequestException('amountClaimedPaisa must be nonnegative integer paisa');
  return String(value);
}
export function futureDate(value: unknown, field = 'expiresAt'): Date {
  const date = new Date(String(value));
  if (!value || isNaN(date.getTime()) || date.getTime() <= Date.now()) throw new BadRequestException(`${field} must be a future ISO date`);
  return date;
}
