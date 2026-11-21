/**
 * Same Idempotency-Key, same answer. The first request runs and its response is
 * saved in idempotency_keys for 24 hours. A repeat with the same key and body gets
 * the saved response without running again. A repeat while the first one is still
 * running gets 409, and the same key with a different body gets 422.
 *
 * TODO(payments step 3, see modules/ledger/ledger.module.ts).
 */
export {};
