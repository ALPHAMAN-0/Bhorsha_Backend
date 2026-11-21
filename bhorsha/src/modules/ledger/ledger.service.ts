import { Injectable } from '@nestjs/common';

/**
 * The only code that writes ledger_entries. Other modules call it with their own
 * transaction (Tx from common/transaction.ts), the way sharing calls RidesService
 * in the seat transaction, so a fare is recorded in the same transaction as the
 * passenger's drop-off (README section 14).
 *
 * Rules:
 * - A transfer's lines must sum to zero; refuse it otherwise. The database checks
 *   this again at commit.
 * - Entries are never updated or deleted. Fix a mistake with a reversing transfer.
 * - A balance is SUM(amount_paisa), computed when read. There is no balance column.
 * - Amounts are whole paisa. Convert to Tk only at the API edge (common/money.ts).
 *
 * TODO(step 2): postTransfer(tx, lines), balanceOf(account), entriesOf(account, cursor).
 */
@Injectable()
export class LedgerService {}
