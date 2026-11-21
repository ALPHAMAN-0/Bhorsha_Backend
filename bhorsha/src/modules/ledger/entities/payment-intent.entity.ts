/**
 * payment_intents: one attempt to collect money through a provider. Cash fares
 * have no intent; they are recorded at drop-off.
 *
 * Planned columns: id, purpose (RIDE_FARE or DRIVER_DUES), payer_user_id,
 * ride_passenger_id (nullable), amount_paisa, provider (BKASH; NAGAD later),
 * provider_ref (unique), status, created_at, updated_at.
 * Status: PENDING -> SUCCEEDED | FAILED | EXPIRED, and SUCCEEDED -> REFUNDED.
 * A status trigger allows only these edges, like the one on rides.
 *
 * TODO(step 4): add @Entity and the columns once the migration exists.
 */
export class PaymentIntent {}
