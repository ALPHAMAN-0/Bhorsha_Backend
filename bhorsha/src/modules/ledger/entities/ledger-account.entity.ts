/**
 * ledger_accounts: one row per account (see accounts.ts). The spec (README
 * section 8) calls this table "wallets"; it is named ledger_accounts because a
 * wallet sounds like stored e-money, which ADR-015 rules out.
 *
 * Planned columns: id, kind, owner_user_id (NULL for platform accounts), created_at;
 * UNIQUE NULLS NOT DISTINCT (kind, owner_user_id).
 *
 * TODO(step 2): add @Entity and the columns once the migration exists.
 */
export class LedgerAccount {}
