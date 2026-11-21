/**
 * ledger_entries: the append-only lines of money transfers.
 *
 * Planned columns: id (bigint), transfer_id (uuid), account_id, amount_paisa
 * (bigint, signed: debit +, credit -), kind (FARE, COMMISSION, REFUND, DUES, ...),
 * ride_passenger_id and payment_intent_id (nullable links), created_at.
 *
 * Database guarantees, in the step 2 migration:
 * - a trigger refuses UPDATE and DELETE, like trg_audit_logs_append_only;
 * - a deferred constraint trigger checks at commit that each transfer_id sums to 0.
 *
 * TODO(step 2): add @Entity and the columns once the migration exists.
 */
export class LedgerEntry {}
