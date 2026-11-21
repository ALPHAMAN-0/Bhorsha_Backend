import { Module } from '@nestjs/common';
import { EarningsController } from './earnings.controller.js';
import { LedgerService } from './ledger.service.js';
import { PaymentSweepService } from './payment-sweep.service.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';

/**
 * Owns ledger_accounts, ledger_entries and payment_intents: all money movement
 * (README section 8, boundary rule 3 "Only ledger moves money", and section 14).
 *
 * Ledger is a leaf module. Trips, fleet and trust import it; it imports no other
 * domain module and never reads their tables. They pass it ids, amounts and
 * their own transaction (Tx from common/transaction.ts).
 *
 * Skeleton only: not registered in AppModule yet. Build order, one PR per step:
 *   1. Migrations setup: src/database/data-source.ts and the migration scripts.
 *   2. Ledger core, cash only: commission at drop-off, driver earnings and dues.
 *   3. Idempotency-Key: src/common/idempotency.
 *   4. Payment intents with the fake provider: the whole bKash flow, offline.
 *   5. Refunds, settling dues by bKash, and the dues limit on going online.
 *   6. The real bKash provider in the sandbox, then nightly reconciliation.
 */
@Module({
  // TODO(step 2): imports: [TypeOrmModule.forFeature([LedgerAccount, LedgerEntry, PaymentIntent])]
  // TODO(step 4): bind PAYMENT_PROVIDER (providers/payment-provider.ts) to the fake or
  // the bKash provider, chosen by the PAYMENT_PROVIDER env variable.
  controllers: [PaymentsController, EarningsController],
  providers: [LedgerService, PaymentsService, PaymentSweepService],
  exports: [LedgerService, PaymentsService],
})
export class LedgerModule {}
