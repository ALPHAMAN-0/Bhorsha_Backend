import { describe, it } from 'vitest';

/**
 * Like seat-concurrency-50: 50 parallel confirms of the same payment must record
 * exactly one ledger transfer. Run it against a test database (DB_NAME=bhorsha_test).
 *
 * TODO(step 4): turn this into a real test.
 */
describe('Payment concurrency: 50 parallel confirms of one payment (e2e)', () => {
  it.todo('records exactly one transfer');
});
