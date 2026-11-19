import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';

/**
 * Seat transaction under load (Architecture v3.1): a driver's running shared CNG
 * ride has exactly one free seat, 50 riders each have a pending request for it,
 * and the driver accepts all 50 at once. Exactly one may win; the other 49 get
 * 409 and roll back, so the seat is never oversold.
 *
 * It creates its own driver, vehicle, ride and 51 riders, so run it against a
 * test database (DB_NAME=bhorsha_test), not your dev data. Needs ALLOW_X_USER_ID=true.
 */
describe('Seat concurrency: 50 parallel accepts on the last seat (e2e)', () => {
  let app: INestApplication<App>;
  let db: DataSource;

  beforeAll(async () => {
    // Requests must outlive the setup; the 12 s production default is for real riders.
    process.env.RIDER_REQUEST_TTL_SECONDS = '600';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    db = moduleFixture.get(DataSource);
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('lets exactly 1 of 50 concurrent accepts take the last seat (49 get 409)', async () => {
    const run = String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
    const one = async <T>(sql: string, params: unknown[] = []): Promise<T> =>
      (await db.query(sql, params))[0] as T;

    // A verified driver with a CNG (2 seats) on a running shared ride.
    const driver = await one<{ id: number }>(
      `INSERT INTO users (full_name, phone, password_hash, role)
       VALUES ('Concurrency Driver', $1, 'x', 'DRIVER') RETURNING id`,
      [`+88013${run}99`],
    );
    await db.query(
      `INSERT INTO driver_profiles (user_id, licence_no, verification, reviewed_by, reviewed_at)
       VALUES ($1, $2, 'VERIFIED', (SELECT id FROM users WHERE role = 'ADMIN' ORDER BY id LIMIT 1), now())`,
      [driver.id, `CONC-${run}`],
    );
    const vehicle = await one<{ id: number }>(
      `INSERT INTO vehicles (driver_id, type, reg_no, seats) VALUES ($1, 'CNG', $2, 2) RETURNING id`,
      [driver.id, `CONC-${run}`],
    );
    const ride = await one<{ id: number }>(
      `INSERT INTO rides (vehicle_type, is_shared, seats_total, seats_free, status,
                          driver_id, vehicle_id, accepted_at)
       VALUES ('CNG', true, 2, 1, 'ACCEPTED', $1, $2, now()) RETURNING id`,
      [driver.id, vehicle.id],
    );

    // Riders: #0 already holds the first seat; #1..#50 compete for the last one.
    const riders: number[] = [];
    for (let i = 0; i <= 50; i++) {
      const rider = await one<{ id: number }>(
        `INSERT INTO users (full_name, phone, password_hash, role)
         VALUES ($1, $2, 'x', 'RIDER') RETURNING id`,
        [`Concurrency Rider ${i}`, `+88017${run}${String(i).padStart(2, '0')}`],
      );
      riders.push(rider.id);
    }
    await db.query(
      `INSERT INTO ride_passengers (ride_id, rider_id, seats, pickup_lat, pickup_lng, drop_lat, drop_lng,
                                    distance_m, locked_fare_paisa, ceiling_paisa, pricing_snapshot, pickup_pin)
       VALUES ($1, $2, 1, 23.7925, 90.4078, 23.7915, 90.4150, 3500, 7000, 9000, '{}'::jsonb, '1234')`,
      [ride.id, riders[0]],
    );

    // Each competing rider asks to join through the API (quote, checks, PENDING request).
    const requestIds: number[] = [];
    for (const riderId of riders.slice(1)) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/join-requests')
        .set('x-user-id', String(riderId))
        .send({
          ride_id: ride.id,
          pickup_lat: 23.7925,
          pickup_lng: 90.4078,
          dropoff_lat: 23.7915,
          dropoff_lng: 90.415,
          distance_km: 3.5,
        });
      expect(res.status).toBe(201);
      requestIds.push(res.body.id ?? res.body.data?.id);
    }
    expect(requestIds).toHaveLength(50);

    // The driver accepts all 50 at the same moment.
    const startTime = Date.now();
    const results = await Promise.allSettled(
      requestIds.map((id) =>
        request(app.getHttpServer())
          .post(`/api/v1/join-requests/${id}/accept`)
          .set('x-user-id', String(driver.id))
          .send(),
      ),
    );
    console.log(`50 parallel accepts on ride ${ride.id} took ${Date.now() - startTime} ms`);

    const statuses = results.map((r) => (r.status === 'fulfilled' ? r.value.status : 0));
    const won = statuses.filter((s) => s === 200 || s === 201).length;
    const conflicts = statuses.filter((s) => s === 409).length;
    console.log(`won: ${won}, 409: ${conflicts}, other: ${50 - won - conflicts}`);
    expect(won).toBe(1);
    expect(conflicts).toBe(49);

    // Never oversold: the ride is full, two live seats, and the books balance.
    const final = await one<{ seats_free: number; live: number; accepted: number }>(
      `SELECT r.seats_free,
              (SELECT count(*)::int FROM ride_passengers p
                WHERE p.ride_id = r.id AND p.status IN ('CONFIRMED', 'PICKED_UP')) AS live,
              (SELECT count(*)::int FROM join_requests j
                WHERE j.ride_id = r.id AND j.status = 'ACCEPTED') AS accepted
         FROM rides r WHERE r.id = $1`,
      [ride.id],
    );
    expect(final).toEqual({ seats_free: 0, live: 2, accepted: 1 });
  }, 60000);
});
