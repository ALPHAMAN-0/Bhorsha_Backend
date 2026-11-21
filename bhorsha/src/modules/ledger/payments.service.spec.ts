import { describe, it } from 'vitest';

/** TODO(steps 4 and 5): turn each item into a real test. */
describe('PaymentsService', () => {
  it.todo('saves the intent as PENDING before calling the provider');
  it.todo(
    'confirm() asks the provider for the real status before recording anything',
  );
  it.todo('a repeated confirm records the transfer only once');
  it.todo('a failed payment records nothing in the ledger');
  it.todo('a refund never exceeds the amount paid');
});
