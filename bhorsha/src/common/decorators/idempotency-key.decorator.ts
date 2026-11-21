/**
 * @IdempotencyKey(): reads the Idempotency-Key header. README section 8 requires
 * it on booking, payment, change, accept, join and handover.
 *
 * TODO(payments step 3, see modules/ledger/ledger.module.ts): a parameter decorator
 * that returns the header, and answers 400 when a route needs it and it is missing.
 */
export {};
