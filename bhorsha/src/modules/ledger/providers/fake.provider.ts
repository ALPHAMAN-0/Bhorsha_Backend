/**
 * PAYMENT_PROVIDER=fake: no network. Its checkout URL sends the payer straight
 * back to the return page as paid, so the whole bKash flow works offline, in
 * Swagger and in e2e tests (ADR-027). It can be told to fail, to test that path.
 *
 * TODO(step 4): implement PaymentProvider (providers/payment-provider.ts).
 */
export class FakePaymentProvider {}
