import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { VehicleType } from '../src/fleet/vehicle-type.js';
import { CreateRideDto } from '../src/trips/dto/create-ride.dto.js';
import { JoinRequest } from '../src/trips/entities/join-request.entity.js';
import { Ride } from '../src/trips/entities/ride.entity.js';
import { TripsService } from '../src/trips/trips.service.js';

describe('Numman Concurrency Suite: 50 Parallel Join Requests on 1 Last Seat (e2e)', () => {
  let app: INestApplication<App>;
  let tripsService: TripsService;

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

    tripsService = moduleFixture.get<TripsService>(TripsService);
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('handles 50 concurrent join-request accept attempts on the final seat (1 winner, 49 rolled back with 409)', async () => {
    // Step 1: Create a shared ride with exactly 2 seats (1 booked by rider, exactly 1 seat left)
    const rideDto: CreateRideDto = {
      origin: 'Banani 11',
      destination: 'Gulshan 2',
      origin_lat: 23.7925,
      origin_lng: 90.4078,
      dest_lat: 23.7915,
      dest_lng: 90.4150,
      distance_km: 3.5,
      vehicle_type: VehicleType.CNG, // CNG has capacity of 2
      is_shared: true,
    };

    const hostRiderId = 1;
    const ride: Ride = await tripsService.createRide(hostRiderId, rideDto);
    expect(ride).toBeDefined();
    expect(ride.seats_total).toBe(2);
    expect(ride.seats_booked).toBe(1); // 1 seat available

    // Step 2: Create 50 distinct pending join requests from passengers 1001 to 1050
    const joinRequests: JoinRequest[] = [];
    for (let i = 1; i <= 50; i++) {
      const passengerId = 1000 + i;
      const joinReq = await tripsService.createJoinRequest(passengerId, {
        ride_id: ride.id,
        seats: 1,
      });
      joinRequests.push(joinReq);
    }
    expect(joinRequests.length).toBe(50);

    // Step 3: Dispatch 50 accept requests concurrently using Promise.allSettled
    console.log(`\n🚀 Launching 50 parallel requests to accept join requests on Ride #${ride.id}...`);
    const startTime = Date.now();

    const acceptPromises = joinRequests.map((req) =>
      request(app.getHttpServer())
        .post(`/api/v1/join-requests/${req.id}/accept`)
        .set('x-user-id', String(hostRiderId))
        .send(),
    );

    const results = await Promise.allSettled(acceptPromises);
    const durationMs = Date.now() - startTime;
    console.log(`⏱️ 50 parallel requests completed in ${durationMs}ms`);

    // Step 4: Analyze response status codes
    let successCount = 0;
    let conflictCount = 0;
    const otherErrors: any[] = [];

    for (const res of results) {
      if (res.status === 'fulfilled') {
        const httpStatus = res.value.status;
        if (httpStatus === 200 || httpStatus === 201) {
          successCount++;
        } else if (httpStatus === 409) {
          conflictCount++;
        } else {
          otherErrors.push({ status: httpStatus, body: res.value.body });
        }
      } else {
        otherErrors.push(res.reason);
      }
    }

    console.log(`📊 Concurrency Results:`);
    console.log(`   - 201/200 Success (Seat Secured): ${successCount}`);
    console.log(`   - 409 Conflict (Rolled Back):    ${conflictCount}`);
    console.log(`   - Other / Unexpected:           ${otherErrors.length}`);

    // Verification Assertions (Exact requirement of Architecture v3.1)
    expect(successCount).toBe(1);
    expect(conflictCount).toBe(49);
    expect(otherErrors.length).toBe(0);

    // Step 5: Verify final state in database
    const finalRide = await tripsService.findOne(ride.id);
    expect(finalRide.seats_booked).toBe(2); // Exactly 2, never oversold!
  }, 45000);
});
