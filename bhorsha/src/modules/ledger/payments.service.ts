import { Injectable } from '@nestjs/common';

/**
 * Payment intents: start, confirm and refund a bKash payment, for a seat's fare
 * (RIDE_FARE) or a driver's dues (DRIVER_DUES).
 *
 * Never call the provider while a database transaction is open:
 *   1. Transaction: save the intent as PENDING, commit.
 *   2. Call the provider, with no transaction open.
 *   3. Transaction: UPDATE ... WHERE status = 'PENDING', record the ledger transfer, commit.
 * If the server stops between 2 and 3, PaymentSweepService finishes the payment.
 *
 * The provider sending the payer back to the app is only a hint: confirm()
 * always asks the provider for the real status before recording anything, and
 * the unique provider_ref makes a repeated confirm do nothing.
 *
 * TODO(step 4): start(seat) returns a checkout URL; confirm(id); findForUser(id).
 * TODO(step 5): refund(id).
 */
@Injectable()
export class PaymentsService {}
