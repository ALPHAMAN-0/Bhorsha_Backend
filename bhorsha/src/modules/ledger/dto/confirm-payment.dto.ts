/**
 * Body of POST /payments/:id/confirm: what the provider sent back to the
 * /payments/return page (for bKash, its paymentID and status). Only a hint: the
 * service asks the provider for the real status.
 *
 * TODO(step 4): the fields, with class-validator decorators.
 */
export class ConfirmPaymentDto {}
