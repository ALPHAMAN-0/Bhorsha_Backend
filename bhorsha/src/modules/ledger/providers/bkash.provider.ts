/**
 * PAYMENT_PROVIDER=bkash: bKash tokenized checkout (developer.bka.sh). Sandbox
 * first; production needs merchant onboarding (README risk R4). Credentials come
 * from BKASH_BASE_URL, BKASH_APP_KEY, BKASH_APP_SECRET, BKASH_USERNAME and
 * BKASH_PASSWORD (README section 20), never from code.
 *
 * TODO(step 6): implement PaymentProvider: grant token, create, execute, query, refund.
 */
export class BkashPaymentProvider {}
