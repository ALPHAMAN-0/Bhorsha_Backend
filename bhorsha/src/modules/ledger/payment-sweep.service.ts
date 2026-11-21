import { Injectable } from '@nestjs/common';

/**
 * Finishes payments left PENDING, for example when the server stopped mid-payment
 * or the payer closed the browser: asks the provider for the real status and
 * records the result, or marks the intent EXPIRED.
 *
 * TODO(step 4): run every few minutes (needs @nestjs/schedule).
 * TODO(step 6): nightly reconciliation against bKash settlement reports (FR-PA-5).
 */
@Injectable()
export class PaymentSweepService {}
