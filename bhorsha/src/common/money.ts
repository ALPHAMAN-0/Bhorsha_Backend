/**
 * Money conversion between the database and the API.
 *
 * The database stores every amount as whole paisa (bigint), so no rounding error can creep into fares.
 * The API speaks Tk (BDT): convert with paisaToTk on the way out and tkToPaisa on the way in.
 * Tk 1 = 100 paisa.
 */
export const PAISA_PER_TK = 100;

/** Largest Tk amount that still fits a whole number of paisa safely. */
export const MAX_TK = Math.floor(Number.MAX_SAFE_INTEGER / PAISA_PER_TK);

export function paisaToTk(paisa: number | string): number {
  return Number(paisa) / PAISA_PER_TK;
}

/** Rounds to the nearest paisa, so 0.29 Tk becomes 29 paisa (not 28.999...). */
export function tkToPaisa(tk: number): number {
  return Math.round(tk * PAISA_PER_TK);
}

/** Basis points (2500) to percent (25). */
export function bpsToPercent(bps: number): number {
  return bps / 100;
}

/** Percent (25) to basis points (2500). */
export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}
