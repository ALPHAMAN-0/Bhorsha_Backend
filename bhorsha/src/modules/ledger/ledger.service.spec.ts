import { describe, it } from 'vitest';

/** TODO(step 2): turn each item into a real test. NFR-13 asks for 90%+ coverage on the ledger. */
describe('LedgerService', () => {
  it.todo('refuses a transfer whose lines do not sum to zero');
  it.todo('splits a fare so commission + driver share = fare, to the paisa');
  it.todo('records a cash fare as DRIVER_DUES -> PLATFORM_COMMISSION');
  it.todo('moves a bKash fare out of FARES_HELD at drop-off');
  it.todo('computes a balance as the sum of the entries');
});
