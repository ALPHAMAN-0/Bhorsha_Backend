/**
 * The ledger accounts (README section 14). The ledger records who owes whom. It
 * never holds riders' money as a balance they can spend or withdraw (ADR-015).
 *
 * Platform accounts have one row each; DRIVER_EARNINGS, DRIVER_DUES and
 * RIDER_CREDIT have one row per user. A balance is SUM(amount_paisa) of the
 * account's entries, computed when it is read.
 */
export enum AccountKind {
  /** Fares paid by bKash at booking and not yet earned. Not in section 14's list; needed until drop-off. */
  FARES_HELD = 'FARES_HELD',
  /** What the platform owes a driver from digitally paid fares. One per driver. */
  DRIVER_EARNINGS = 'DRIVER_EARNINGS',
  /** What a driver owes the platform: commission on cash fares. One per driver; above dues_limit they can't go online. */
  DRIVER_DUES = 'DRIVER_DUES',
  /** The platform's commission. */
  PLATFORM_COMMISSION = 'PLATFORM_COMMISSION',
  /** Money on its way through bKash: collected or paid out, not yet settled. */
  GATEWAY_CLEARING = 'GATEWAY_CLEARING',
  /** Refunds the platform owes riders and hasn't paid yet. */
  REFUNDS_PAYABLE = 'REFUNDS_PAYABLE',
  /** Non-withdrawable ride credit for change. Phase 2, only after the legal opinion (README risk R2). One per rider. */
  RIDER_CREDIT = 'RIDER_CREDIT',
  /** Platform-funded jam protection paid to drivers (README section 13). */
  JAM_PROTECTION = 'JAM_PROTECTION',
}
