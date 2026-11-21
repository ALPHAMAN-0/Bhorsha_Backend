/**
 * The idempotency_keys table (README section 17). It lives in common/ because
 * bookings, accepts and joins need it too, not only payments.
 *
 * Planned columns: id, user_id, key, request_hash, response_status,
 * response_body (jsonb), created_at; unique (user_id, key). Rows older than
 * 24 hours can be deleted.
 *
 * TODO(payments step 3): add @Entity and the columns once the migration exists.
 */
export class IdempotencyRecord {}
