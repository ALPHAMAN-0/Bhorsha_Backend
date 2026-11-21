import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * Planned routes for the logged-in driver (amounts in Tk):
 *   GET  /drivers/me/earnings      Earnings and dues, with their entries (cursor pagination)
 *   POST /drivers/me/dues/settle   Pay dues by bKash; returns a checkout URL (Idempotency-Key)
 *
 * TODO(step 2): earnings. TODO(step 5): dues/settle.
 */
@ApiTags('Driver earnings')
@Controller('drivers/me')
export class EarningsController {}
