/**
 * One recipe per money event. Each recipe returns the lines of one transfer,
 * and the lines of a transfer always sum to zero. "A -> B" means debit A, credit B.
 *
 *   Cash ride, at drop-off         DRIVER_DUES -> PLATFORM_COMMISSION (commission)
 *   bKash payment confirmed        GATEWAY_CLEARING -> FARES_HELD (fare)
 *   bKash ride, at drop-off        FARES_HELD -> DRIVER_EARNINGS (fare - commission)
 *                                  FARES_HELD -> PLATFORM_COMMISSION (commission)
 *   Cancel before pickup (bKash)   FARES_HELD -> REFUNDS_PAYABLE, then
 *                                  REFUNDS_PAYABLE -> GATEWAY_CLEARING once bKash refunds
 *   Driver pays dues by bKash      GATEWAY_CLEARING -> DRIVER_DUES
 *   Change (Phase 2, after R2)     DRIVER_DUES -> RIDER_CREDIT
 *
 * Commission is whole paisa: commission = round(fare * bps / 10000), and the
 * driver gets fare - commission, so the two parts always add up to the fare.
 * The rate is locked in the passenger's pricing_snapshot at booking, like the fare.
 *
 * TODO(step 2): the cash recipe. TODO(step 4): the bKash ones. TODO(step 5): refunds and dues.
 */
export {};
