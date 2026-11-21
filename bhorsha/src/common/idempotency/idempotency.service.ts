import { Injectable } from '@nestjs/common';

/**
 * Saves and looks up idempotency_keys rows for IdempotencyInterceptor
 * (common/interceptors/idempotency.interceptor.ts).
 *
 * TODO(payments step 3, see modules/ledger/ledger.module.ts).
 */
@Injectable()
export class IdempotencyService {}
