import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { VehicleType } from '../src/fleet/vehicle-type.js';
import { RideStatus } from '../src/trips/entities/ride.entity.js';

describe('Rider Domain Complete Lifecycle Suite (13 Endpoints End-to-End)', () => {
  let app: INestApplication<App>;
  let createdRideId: string;
  let passenger2JoinRequestId: number;
  let passenger3JoinRequestId: number;

  const RIDER_1 = 1;
  const PASSENGER_2 = 2;
  const PASSENGER_3 = 3;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('1. GET /rides/quote - calculates upfront fare with BRTA ceiling rules', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/rides/quote')
      .query({ vehicle_type: VehicleType.CAR, distance_km: 7.5, is_shared: false })
      .expect(200);

    expect(res.body).toHaveProperty('base_fare_bdt', 85);
    expect(res.body).toHaveProperty('per_km_bdt', 34);
    expect(res.body).toHaveProperty('subtotal_bdt', 340);
    expect(res.body).toHaveProperty('total_fare_bdt', 340);
    expect(res.body).toHaveProperty('currency', 'BDT');
  });

  it('2. POST /rides - Rider #1 creates a shared CNG ride (capacity 2)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/rides')
      .set('x-user-id', String(RIDER_1))
      .send({
        origin: 'Dhanmondi 27',
        destination: 'Gulshan 1',
        distance_km: 6.0,
        vehicle_type: VehicleType.CNG,
        is_shared: true,
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.rider_id).toBe(RIDER_1);
    expect(res.body.status).toBe(RideStatus.REQUESTED);
    expect(res.body.seats_total).toBe(2);
    expect(res.body.seats_booked).toBe(1); // Rider #1 takes 1st seat

    createdRideId = res.body.id;
  });

  it('3. GET /rides/my - Rider #1 views active/past rides', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/rides/my')
      .set('x-user-id', String(RIDER_1))
      .query({ page: 1, limit: 10 })
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    const found = res.body.data.find((r: any) => r.id === createdRideId);
    expect(found).toBeDefined();
  });

  it('4. GET /rides - Support/Admin lists all platform rides', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/rides')
      .query({ status: RideStatus.REQUESTED })
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
  });

  it('5. GET /rides/:id - Retrieves specific ride details', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/rides/${createdRideId}`)
      .expect(200);

    expect(res.body.id).toBe(createdRideId);
    expect(res.body.origin).toBe('Dhanmondi 27');
  });

  it('6. GET /route-offers/nearby - Passenger #2 finds available shared rides', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/route-offers/nearby')
      .query({ lat: 23.8103, lng: 90.4125, radius_km: 5 })
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find((r: any) => r.id === createdRideId);
    expect(found).toBeDefined();
  });

  it('7. POST /join-requests - Passenger #2 requests to join the shared ride', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/join-requests')
      .set('x-user-id', String(PASSENGER_2))
      .send({
        ride_id: createdRideId,
        seats: 1,
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.passenger_id).toBe(PASSENGER_2);
    expect(res.body.status).toBe('PENDING');

    passenger2JoinRequestId = res.body.id;
  });

  it('8. GET /join-requests/my - Passenger #2 views submitted requests', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/join-requests/my')
      .set('x-user-id', String(PASSENGER_2))
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find((r: any) => r.id === passenger2JoinRequestId);
    expect(found).toBeDefined();
  });

  it('9. POST /join-requests/:id/decline - Rider #1 declines an unwanted request from Passenger #3', async () => {
    // Passenger #3 creates a request
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/join-requests')
      .set('x-user-id', String(PASSENGER_3))
      .send({ ride_id: createdRideId, seats: 1 })
      .expect(201);
    passenger3JoinRequestId = createRes.body.id;

    // Rider #1 declines it
    const declineRes = await request(app.getHttpServer())
      .post(`/api/v1/join-requests/${passenger3JoinRequestId}/decline`)
      .set('x-user-id', String(RIDER_1))
      .expect(201);

    expect(declineRes.body.status).toBe('DECLINED');
  });

  it('10. POST /join-requests/:id/accept - Rider #1 accepts Passenger #2 with atomic lock', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/join-requests/${passenger2JoinRequestId}/accept`)
      .set('x-user-id', String(RIDER_1))
      .expect(201);

    expect(res.body.status).toBe('ACCEPTED');

    // Verify ride now has 2/2 seats booked
    const rideRes = await request(app.getHttpServer())
      .get(`/api/v1/rides/${createdRideId}`)
      .expect(200);
    expect(rideRes.body.seats_booked).toBe(2);
  });

  it('11. POST /ratings - Confirmed Passenger #2 rates the ride', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/ratings')
      .set('x-user-id', String(PASSENGER_2))
      .send({
        ride_id: createdRideId,
        ratee_id: RIDER_1,
        score: 5,
        comment: 'Great ride-sharing companion, on-time and safe.',
      })
      .expect(201);

    expect(res.body.score).toBe(5);
    expect(res.body.rater_id).toBe(PASSENGER_2);
  });

  it('12. POST /rides/:id/sos - Triggers emergency SOS alert with Mailpit email dispatch', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/rides/${createdRideId}/sos`)
      .set('x-user-id', String(PASSENGER_2))
      .send({
        lat: 23.7925,
        lng: 90.4078,
      })
      .expect(201);

    expect(res.body.status).toBe('TRIGGERED');
    expect(res.body.ride_id).toBe(createdRideId);
    expect(res.body.user_id).toBe(PASSENGER_2);
  });

  it('13. POST /sos - Triggers general SOS distress signal', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/sos')
      .set('x-user-id', String(RIDER_1))
      .send({
        lat: 23.8103,
        lng: 90.4125,
      })
      .expect(201);

    expect(res.body.status).toBe('TRIGGERED');
    expect(res.body.user_id).toBe(RIDER_1);
  });

  it('14. POST /rides/:id/cancel - Cancels a solo ride', async () => {
    // Create a new solo ride
    const soloRes = await request(app.getHttpServer())
      .post('/api/v1/rides')
      .set('x-user-id', String(RIDER_1))
      .send({
        origin: 'Uttara Sector 3',
        destination: 'Airport',
        distance_km: 4.0,
        vehicle_type: VehicleType.BIKE,
        is_shared: false,
      })
      .expect(201);

    const soloRideId = soloRes.body.id;

    // Cancel the ride
    const cancelRes = await request(app.getHttpServer())
      .post(`/api/v1/rides/${soloRideId}/cancel`)
      .set('x-user-id', String(RIDER_1))
      .expect(201);

    expect(cancelRes.body.status).toBe(RideStatus.CANCELLED);

    // Verify trying to cancel again throws 400 Bad Request
    await request(app.getHttpServer())
      .post(`/api/v1/rides/${soloRideId}/cancel`)
      .set('x-user-id', String(RIDER_1))
      .expect(400);
  });
});
