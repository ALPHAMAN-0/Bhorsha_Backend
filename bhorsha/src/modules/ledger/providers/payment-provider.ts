/**
 * The port every payment provider implements (ADR-027). The PAYMENT_PROVIDER env
 * variable picks one at start-up: "fake" for local work, Swagger and tests, or
 * "bkash" for bKash tokenized checkout.
 *
 * Every method goes over the network, so never call one while a database
 * transaction is open (see payments.service.ts).
 */

/** Nest injection token for the chosen provider. */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

/** What the provider says about a payment. */
export type ProviderPaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';

export interface PaymentProvider {
  /** Starts a checkout. The payer goes to checkoutUrl; the provider sends them back to returnUrl. */
  createCheckout(input: {
    intentId: number;
    amountPaisa: number;
    returnUrl: string;
  }): Promise<{ providerRef: string; checkoutUrl: string }>;

  /** Completes a checkout the payer approved (bKash: execute) and returns the real status. */
  complete(providerRef: string): Promise<ProviderPaymentStatus>;

  /** Asks for the real status, for confirm() and the sweep job. */
  getStatus(providerRef: string): Promise<ProviderPaymentStatus>;

  /** Refunds all or part of a successful payment. */
  refund(input: {
    providerRef: string;
    amountPaisa: number;
    reason: string;
  }): Promise<{ refundRef: string }>;
}
