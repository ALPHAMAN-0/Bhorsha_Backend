import { describe, it } from 'vitest';

/**
 * Payments end to end with PAYMENT_PROVIDER=fake. Like the other e2e files, run
 * it against a test database (DB_NAME=bhorsha_test), not your dev data.
 *
 * TODO(steps 2 to 5): turn each item into a real test.
 */
describe('Payments (e2e)', () => {
  it.todo('cash ride: the drop-off records the commission in the driver dues');
  it.todo(
    'bKash ride: pay, confirm, drop-off moves the fare from FARES_HELD to the driver',
  );
  it.todo('the same Idempotency-Key twice starts only one payment');
  it.todo('cancelling before pickup refunds a paid seat');
  it.todo('a driver above the dues limit cannot go online');
});
