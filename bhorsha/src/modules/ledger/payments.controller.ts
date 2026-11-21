import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * Planned routes (amounts in Tk):
 *   GET  /payments               All payments; filter by status (Support+)
 *   GET  /payments/my            Own payments and refunds (Rider or Driver)
 *   GET  /payments/:id           One payment (the payer, or Support+)
 *   POST /payments/:id/confirm   Called by the frontend's /payments/return page (the payer)
 *   POST /payments/:id/refund    Refund, e.g. after an OVERCHARGE case (Support+)
 *
 * Declare GET /payments/my before GET /payments/:id. Confirm and refund need an
 * Idempotency-Key header.
 *
 * Starting a fare payment is POST /rides/:id/payment in trips: trips reads its own
 * seat and calls PaymentsService, so ledger never reads trips' tables.
 *
 * TODO(step 4): list, my, get and confirm. TODO(step 5): refund.
 */
@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {}
