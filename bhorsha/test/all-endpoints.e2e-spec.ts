import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

/**
 * Every one of the 55 endpoints, called the way a client calls them (real login
 * tokens, the /api/v1 prefix, validation and the response envelope), as one story:
 * accounts -> driver setup -> a solo ride -> a shared ride -> support cases.
 * Each `it` is named after the endpoint it checks: its normal answer first, then
 * the main refusals (401, 403, 404, 409, 400).
 *
 * Needs the database and Mailpit (`docker compose up -d`). Only the seed admin
 * (+8801700000001 / Bhorsha@123) has to exist: every other account, vehicle, ride
 * and case is created here with random phone and registration numbers, so the
 * suite can run again on the same database. It adds rows on every run, so prefer
 * a throwaway database (doc/API-TESTING.md shows how).
 */

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';
interface Who {
  id: number;
  token: string;
}
interface Point {
  lat: number;
  lng: number;
}
// Response bodies are checked field by field; `any` keeps those checks short.
type Body = any;

const SEED_ADMIN_PHONE = '+8801700000001';
const PASSWORD = 'Bhorsha@123';

let app: INestApplication<App>;

const digits = (n: number) =>
  Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
const newPhone = () => `+88019${digits(8)}`;
const newRegNo = () => `DHAKA METRO-GA ${digits(2)}-${digits(4)}`;

/** Sends one request; `who` null means no token. Returns the status and the parsed body. */
async function call(method: Method, path: string, who?: Who | null, body?: object) {
  let req = request(app.getHttpServer())[method](`/api/v1${path}`);
  if (who) {
    req = req.set('Authorization', `Bearer ${who.token}`);
  }
  const res = body === undefined ? await req : await req.send(body);
  return { status: res.status, body: res.body as Body };
}

/** Calls and checks the status; on a mismatch the message shows the response body. */
async function expectCall(
  status: number,
  method: Method,
  path: string,
  who?: Who | null,
  body?: object,
): Promise<Body> {
  const res = await call(method, path, who, body);
  expect(res.status, `${method.toUpperCase()} ${path} -> ${JSON.stringify(res.body)}`).toBe(status);
  return res.body;
}

async function login(phone: string): Promise<Who> {
  const body = await expectCall(200, 'post', '/auth/login', null, { phone, password: PASSWORD });
  return { id: body.data.user.id, token: body.data.accessToken };
}

/** Registers a rider or driver through the API and logs them in. */
async function signUp(role: 'RIDER' | 'DRIVER', fullName: string): Promise<Who> {
  const phone = newPhone();
  await expectCall(201, 'post', '/auth/register', null, {
    fullName,
    phone,
    password: PASSWORD,
    role,
    ...(role === 'DRIVER' ? { licenceNo: `E2E-${digits(10)}` } : {}),
  });
  return login(phone);
}

/** The doc/databaseSQL.md fare formula, in paisa, from a fare rule as GET /fare-rules shows it (Tk). */
function expectedFare(rule: Body, distanceM: number) {
  const paisa = (tk: number) => Math.round(tk * 100);
  const extraM = Math.max(distanceM - rule.baseDistanceM, 0);
  const solo = paisa(rule.baseTk) + Math.round((paisa(rule.perKmTk) * extraM) / 1000);
  const ceiling = paisa(rule.ceilingBaseTk) + Math.round((paisa(rule.ceilingPerKmTk) * extraM) / 1000);
  const shared = Math.round((solo * (10000 - Math.round(rule.shareDiscountPercent * 100))) / 10000);
  return { solo: Math.min(solo, ceiling) / 100, shared: Math.min(shared, ceiling) / 100, ceiling: ceiling / 100 };
}

describe('All 55 endpoints (e2e)', { timeout: 30_000 }, () => {
  // A random spot in central Dhaka, so earlier runs' rides and offers are not "nearby".
  const spot: Point = { lat: 23.74 + Math.random() * 0.08, lng: 90.37 + Math.random() * 0.06 };
  const near = (dLat: number, dLng: number): Point => ({ lat: spot.lat + dLat, lng: spot.lng + dLng });
  const farAway: Point = near(-0.045, -0.035); // about 6 km from the spot

  let admin: Who;
  let officerA: Who; // issues the strike
  let officerB: Who; // decides the appeal
  let riderA: Who;
  let riderB: Who;
  let riderC: Who;
  let driver: Who; // the main driver, verified
  let otherDriver: Who; // verified, used for "someone else's" checks
  let pendingDriver: Who; // never verified
  let staffToDeactivate: Who;
  let fareRules: Body[] = [];

  let carId: number;
  let carRegNo: string;
  let bikeId: number;
  let soloRideId: number;
  let soloSeat: Body;
  let offerId: number;
  let sharedRideId: number;
  let requestOfB: number;
  let requestOfA: number;
  let waitingRideOfC: number;
  let caseId: number;
  let strikeId: number;
  let appealId: number;

  beforeAll(async () => {
    // Join requests must outlive the test steps; the 12 s default is for real riders.
    process.env.RIDER_REQUEST_TTL_SECONDS = '600';
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication({ logger: ['error'] });
    configureApp(app);
    await app.init();
    admin = await login(SEED_ADMIN_PHONE);
  }, 60_000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // ------------------------------------------------------------------------------------------
  describe('Accounts and admin (11 endpoints)', () => {
    it('POST /auth/register: riders and drivers sign up; bad sign-ups are refused', async () => {
      const phone = newPhone();
      const rider = await expectCall(201, 'post', '/auth/register', null, {
        fullName: 'E2E Rider A',
        phone,
        email: `e2e.${digits(8)}@example.com`,
        password: PASSWORD,
        role: 'RIDER',
      });
      expect(rider.data).toMatchObject({ role: 'RIDER', isActive: true, driverProfile: null });
      expect(rider.data).not.toHaveProperty('passwordHash');
      riderA = await login(phone);

      const driverPhone = newPhone();
      const created = await expectCall(201, 'post', '/auth/register', null, {
        fullName: 'E2E Driver',
        phone: driverPhone,
        password: PASSWORD,
        role: 'DRIVER',
        licenceNo: `E2E-${digits(10)}`,
      });
      expect(created.data.driverProfile).toMatchObject({ verification: 'PENDING', status: 'OFFLINE' });
      driver = await login(driverPhone);

      riderB = await signUp('RIDER', 'E2E Rider B');
      riderC = await signUp('RIDER', 'E2E Rider C');
      otherDriver = await signUp('DRIVER', 'E2E Other Driver');
      pendingDriver = await signUp('DRIVER', 'E2E Pending Driver');

      await expectCall(409, 'post', '/auth/register', null, {
        fullName: 'Same phone', phone, password: PASSWORD, role: 'RIDER',
      });
      await expectCall(400, 'post', '/auth/register', null, {
        fullName: 'No licence', phone: newPhone(), password: PASSWORD, role: 'DRIVER',
      });
      await expectCall(400, 'post', '/auth/register', null, {
        fullName: 'Not allowed', phone: newPhone(), password: PASSWORD, role: 'ADMIN',
      });
      await expectCall(400, 'post', '/auth/register', null, {
        fullName: 'Bad phone', phone: '01712345678', password: PASSWORD, role: 'RIDER',
      });
    });

    it('POST /auth/login: a token for the right password, 401 otherwise', async () => {
      const body = await expectCall(200, 'post', '/auth/login', null, {
        phone: SEED_ADMIN_PHONE,
        password: PASSWORD,
      });
      expect(body.data).toMatchObject({ tokenType: 'Bearer', user: { role: 'ADMIN' } });
      expect(typeof body.data.accessToken).toBe('string');
      await expectCall(401, 'post', '/auth/login', null, { phone: SEED_ADMIN_PHONE, password: 'wrong-password' });
      await expectCall(401, 'post', '/auth/login', null, { phone: newPhone(), password: PASSWORD });
      await expectCall(400, 'post', '/auth/login', null, { phone: 'not-a-phone', password: PASSWORD });
    });

    it('POST /users: an admin creates Support Officer accounts', async () => {
      const makeOfficer = async (fullName: string) => {
        const phone = newPhone();
        const body = await expectCall(201, 'post', '/users', admin, {
          fullName, phone, password: PASSWORD, role: 'SUPPORT',
        });
        expect(body.data.role).toBe('SUPPORT');
        return login(phone);
      };
      officerA = await makeOfficer('E2E Officer A');
      officerB = await makeOfficer('E2E Officer B');
      staffToDeactivate = await makeOfficer('E2E Officer To Deactivate');

      await expectCall(400, 'post', '/users', admin, {
        fullName: 'Rider', phone: newPhone(), password: PASSWORD, role: 'RIDER',
      });
      await expectCall(403, 'post', '/users', officerA, {
        fullName: 'X', phone: newPhone(), password: PASSWORD, role: 'SUPPORT',
      });
      await expectCall(401, 'post', '/users', null, {
        fullName: 'X', phone: newPhone(), password: PASSWORD, role: 'SUPPORT',
      });
    });

    it('GET /users: admin-only list with paging and filters', async () => {
      const page = await expectCall(200, 'get', '/users?page=1&limit=5', admin);
      expect(page.data).toHaveLength(5);
      expect(page.meta).toMatchObject({ page: 1, limit: 5 });
      const drivers = await expectCall(200, 'get', '/users?role=DRIVER&status=ACTIVE&limit=50', admin);
      expect(drivers.data.length).toBeGreaterThan(0);
      expect(drivers.data.every((u: Body) => u.role === 'DRIVER' && u.isActive)).toBe(true);
      await expectCall(403, 'get', '/users', riderA);
      await expectCall(401, 'get', '/users');
      await expectCall(400, 'get', '/users?limit=500', admin);
    });

    it('GET /users/:id: one user for the admin', async () => {
      const body = await expectCall(200, 'get', `/users/${riderA.id}`, admin);
      expect(body.data).toMatchObject({ id: riderA.id, fullName: 'E2E Rider A' });
      await expectCall(404, 'get', '/users/999999', admin);
      await expectCall(400, 'get', '/users/abc', admin);
      await expectCall(400, 'get', '/users/99999999999', admin); // above the integer range: 400, not 500
      await expectCall(403, 'get', `/users/${riderA.id}`, riderA);
    });

    it('PATCH /users/:id: owners edit their profile; role and status are admin-only', async () => {
      const renamed = await expectCall(200, 'patch', `/users/${riderA.id}`, riderA, { fullName: 'E2E Rider A2' });
      expect(renamed.data.fullName).toBe('E2E Rider A2');
      await expectCall(403, 'patch', `/users/${riderB.id}`, riderA, { fullName: 'Not mine' });
      await expectCall(403, 'patch', `/users/${riderA.id}`, riderA, { role: 'ADMIN' });
      await expectCall(400, 'patch', `/users/${riderA.id}`, riderA, {});

      const until = new Date(Date.now() + 3 * 86_400_000).toISOString();
      const suspended = await expectCall(200, 'patch', `/users/${riderB.id}`, admin, { suspendedUntil: until });
      expect(suspended.data.suspendedUntil).not.toBeNull();
      const lifted = await expectCall(200, 'patch', `/users/${riderB.id}`, admin, { suspendedUntil: null });
      expect(lifted.data.suspendedUntil).toBeNull();
    });

    it('DELETE /users/:id: deactivates (never deletes); the account stops working at once', async () => {
      await expectCall(204, 'delete', `/users/${staffToDeactivate.id}`, admin);
      await expectCall(401, 'get', '/cases', staffToDeactivate); // its old token no longer works
      await expectCall(403, 'delete', `/users/${admin.id}`, admin);
      await expectCall(404, 'delete', '/users/999999', admin);
      await expectCall(403, 'delete', `/users/${riderB.id}`, riderA);
      const body = await expectCall(200, 'get', `/users/${staffToDeactivate.id}`, admin);
      expect(body.data.isActive).toBe(false);
    });

    it('GET /drivers: the admin review queue', async () => {
      const body = await expectCall(200, 'get', '/drivers?verification=PENDING&limit=50', admin);
      expect(body.data.every((d: Body) => d.verification === 'PENDING')).toBe(true);
      // Oldest first, so the newest sign-ups may be on a later page.
      const all = await expectCall(200, 'get', `/drivers?verification=PENDING&limit=50&page=${Math.max(1, Math.ceil(body.meta.total / 50))}`, admin);
      expect(all.data.some((d: Body) => d.userId === driver.id)).toBe(true);
      await expectCall(403, 'get', '/drivers', riderA);
    });

    it('PATCH /drivers/:id/verify: approve or reject a driver', async () => {
      await expectCall(400, 'patch', `/drivers/${driver.id}/verify`, admin, { verification: 'REJECTED' });
      const body = await expectCall(200, 'patch', `/drivers/${driver.id}/verify`, admin, { verification: 'VERIFIED' });
      expect(body.data).toMatchObject({ verification: 'VERIFIED', reviewedBy: admin.id });
      await expectCall(200, 'patch', `/drivers/${otherDriver.id}/verify`, admin, { verification: 'VERIFIED' });
      await expectCall(409, 'patch', `/drivers/${driver.id}/verify`, admin, { verification: 'VERIFIED' });
      await expectCall(404, 'patch', `/drivers/${riderA.id}/verify`, admin, { verification: 'VERIFIED' });
      await expectCall(403, 'patch', `/drivers/${pendingDriver.id}/verify`, riderA, { verification: 'VERIFIED' });
    });

    it('GET /fare-rules: one rule per vehicle type, in Tk', async () => {
      const body = await expectCall(200, 'get', '/fare-rules', admin);
      fareRules = body.data;
      expect(fareRules.map((r) => r.vehicleType)).toEqual(expect.arrayContaining(['BIKE', 'CAR', 'CNG']));
      expect(fareRules).toHaveLength(3);
      expect(fareRules.every((r) => r.baseTk <= r.ceilingBaseTk && r.perKmTk <= r.ceilingPerKmTk)).toBe(true);
      await expectCall(403, 'get', '/fare-rules', riderA);
    });

    it('PATCH /fare-rules/:id: change a tariff, never above the legal ceiling', async () => {
      const car = fareRules.find((r) => r.vehicleType === 'CAR');
      try {
        const body = await expectCall(200, 'patch', `/fare-rules/${car.id}`, admin, { baseTk: car.ceilingBaseTk });
        expect(body.data).toMatchObject({ baseTk: car.ceilingBaseTk, updatedBy: admin.id });
        await expectCall(409, 'patch', `/fare-rules/${car.id}`, admin, { perKmTk: car.ceilingPerKmTk + 1 });
        await expectCall(400, 'patch', `/fare-rules/${car.id}`, admin, { ceilingBaseTk: 1000 });
        await expectCall(400, 'patch', `/fare-rules/${car.id}`, admin, {});
        await expectCall(404, 'patch', '/fare-rules/999', admin, { baseTk: 10 });
        await expectCall(403, 'patch', `/fare-rules/${car.id}`, riderA, { baseTk: 10 });
      } finally {
        await expectCall(200, 'patch', `/fare-rules/${car.id}`, admin, {
          baseTk: car.baseTk,
          perKmTk: car.perKmTk,
          shareDiscountPercent: car.shareDiscountPercent,
        });
      }
    });
  });

  // ------------------------------------------------------------------------------------------
  describe('Driver setup (8 endpoints)', () => {
    it('GET /drivers/me: own driver profile', async () => {
      const body = await expectCall(200, 'get', '/drivers/me', driver);
      expect(body.data).toMatchObject({ userId: driver.id, verification: 'VERIFIED', status: 'OFFLINE' });
      await expectCall(403, 'get', '/drivers/me', riderA);
      await expectCall(401, 'get', '/drivers/me');
    });

    it('POST /vehicles: add a vehicle; seats come from the type', async () => {
      carRegNo = newRegNo();
      const car = await expectCall(201, 'post', '/vehicles', driver, { type: 'CAR', regNo: carRegNo });
      expect(car.data).toMatchObject({ type: 'CAR', seats: 3, driverId: driver.id });
      carId = car.data.id;
      const bike = await expectCall(201, 'post', '/vehicles', driver, { type: 'BIKE', regNo: newRegNo() });
      expect(bike.data.seats).toBe(1);
      bikeId = bike.data.id;
      await expectCall(201, 'post', '/vehicles', otherDriver, { type: 'BIKE', regNo: newRegNo() });

      await expectCall(409, 'post', '/vehicles', driver, { type: 'CAR', regNo: carRegNo });
      await expectCall(400, 'post', '/vehicles', driver, { type: 'CAR', regNo: 'abc' });
      await expectCall(400, 'post', '/vehicles', driver, { type: 'TRUCK', regNo: newRegNo() });
      await expectCall(403, 'post', '/vehicles', riderA, { type: 'CAR', regNo: newRegNo() });
    });

    it('GET /vehicles/my: own vehicles with paging', async () => {
      const body = await expectCall(200, 'get', '/vehicles/my?page=1&limit=10', driver);
      expect(body.data.map((v: Body) => v.id)).toEqual(expect.arrayContaining([carId, bikeId]));
      expect(body.data).toHaveLength(2);
      expect(body.meta).toMatchObject({ page: 1, limit: 10, total: 2 });
      await expectCall(403, 'get', '/vehicles/my', riderA);
    });

    it('GET /vehicles/:id: one of my vehicles', async () => {
      const body = await expectCall(200, 'get', `/vehicles/${carId}`, driver);
      expect(body.data).toMatchObject({ id: carId, regNo: carRegNo });
      await expectCall(403, 'get', `/vehicles/${carId}`, otherDriver);
      await expectCall(404, 'get', '/vehicles/999999', driver);
    });

    it('PATCH /vehicles/:id: change the registration number', async () => {
      const regNo = newRegNo();
      const body = await expectCall(200, 'patch', `/vehicles/${bikeId}`, driver, { regNo });
      expect(body.data.regNo).toBe(regNo);
      await expectCall(409, 'patch', `/vehicles/${bikeId}`, driver, { regNo: carRegNo });
      await expectCall(400, 'patch', `/vehicles/${bikeId}`, driver, { type: 'CAR' });
      await expectCall(403, 'patch', `/vehicles/${bikeId}`, otherDriver, { regNo: newRegNo() });
    });

    it('DELETE /vehicles/:id: soft delete', async () => {
      await expectCall(403, 'delete', `/vehicles/${bikeId}`, otherDriver);
      await expectCall(204, 'delete', `/vehicles/${bikeId}`, driver);
      await expectCall(404, 'get', `/vehicles/${bikeId}`, driver);
      await expectCall(404, 'delete', `/vehicles/${bikeId}`, driver);
    });

    it('PATCH /drivers/me/status: only a verified driver can go online', async () => {
      await expectCall(403, 'patch', '/drivers/me/status', pendingDriver, { status: 'ONLINE' });
      const body = await expectCall(200, 'patch', '/drivers/me/status', driver, { status: 'ONLINE' });
      expect(body.data.status).toBe('ONLINE');
      await expectCall(200, 'patch', '/drivers/me/status', otherDriver, { status: 'ONLINE' });
      await expectCall(400, 'patch', '/drivers/me/status', driver, { status: 'BUSY' });
    });

    it('PUT /drivers/me/location: post the current position', async () => {
      const body = await expectCall(200, 'put', '/drivers/me/location', driver, spot);
      expect(body.data).toMatchObject({ lastLat: spot.lat, lastLng: spot.lng });
      await expectCall(200, 'put', '/drivers/me/location', otherDriver, farAway);
      await expectCall(400, 'put', '/drivers/me/location', driver, { lat: 123, lng: 90 });
      await expectCall(403, 'put', '/drivers/me/location', riderA, spot);
    });
  });

  // ------------------------------------------------------------------------------------------
  describe('A solo ride from booking to rating (14 endpoints)', () => {
    const pickup = near(0.001, 0.0005); // about 120 m from the driver

    it('GET /rides/quote: the documented fare formula, with the legal ceiling', async () => {
      const car = fareRules.find((r) => r.vehicleType === 'CAR');
      const expected = expectedFare(car, 10_000);
      const solo = await expectCall(200, 'get', '/rides/quote?vehicle_type=CAR&distance_km=10', riderA);
      expect(solo.data).toMatchObject({
        total_fare_bdt: expected.solo,
        shared_fare_bdt: expected.shared,
        brta_ceiling_bdt: expected.ceiling,
        currency: 'BDT',
      });
      const shared = await expectCall(200, 'get', '/rides/quote?vehicle_type=CAR&distance_km=10&is_shared=true', riderA);
      expect(shared.data.fare_share_bdt).toBe(expected.shared);
      await expectCall(400, 'get', '/rides/quote?vehicle_type=BIKE&is_shared=true', riderA);
      await expectCall(400, 'get', '/rides/quote?vehicle_type=TRUCK', riderA);
      await expectCall(400, 'get', '/rides/quote?distance_km=abc', riderA);
      await expectCall(401, 'get', '/rides/quote');
    });

    it('POST /rides: a rider books; the fare is locked and a PIN is issued', async () => {
      const body = await expectCall(201, 'post', '/rides', riderA, {
        origin: 'E2E pickup',
        destination: 'E2E drop-off',
        vehicle_type: 'CAR',
        is_shared: false,
        origin_lat: pickup.lat,
        origin_lng: pickup.lng,
        dest_lat: farAway.lat,
        dest_lng: farAway.lng,
        distance_km: 6.5,
      });
      const car = fareRules.find((r) => r.vehicleType === 'CAR');
      expect(body.data).toMatchObject({ status: 'REQUESTED', is_shared: false, driver_id: null });
      soloSeat = body.data.passengers[0];
      expect(soloSeat).toMatchObject({ rider_id: riderA.id, status: 'CONFIRMED', fare_bdt: expectedFare(car, 6500).solo });
      expect(soloSeat.pickup_pin).toMatch(/^\d{4}$/);
      soloRideId = body.data.id;

      await expectCall(403, 'post', '/rides', driver, {
        origin_lat: pickup.lat, origin_lng: pickup.lng, dest_lat: farAway.lat, dest_lng: farAway.lng,
      });
      await expectCall(400, 'post', '/rides', riderB, { vehicle_type: 'CAR' });
      await expectCall(400, 'post', '/rides', riderB, {
        vehicle_type: 'BIKE', is_shared: true,
        origin_lat: pickup.lat, origin_lng: pickup.lng, dest_lat: farAway.lat, dest_lng: farAway.lng,
      });
    });

    it('GET /rides/open: an online driver sees nearby requests for a type they own', async () => {
      const body = await expectCall(200, 'get', '/rides/open', driver);
      const mine = body.data.find((r: Body) => r.rideId === soloRideId);
      expect(mine).toMatchObject({ vehicleType: 'CAR', fareTk: soloSeat.fare_bdt });
      expect(mine.distanceKm).toBeLessThan(1);
      const far = await expectCall(200, 'get', '/rides/open', otherDriver); // 6 km away, and owns no car
      expect(far.data.some((r: Body) => r.rideId === soloRideId)).toBe(false);
      await expectCall(403, 'get', '/rides/open', pendingDriver);
      await expectCall(403, 'get', '/rides/open', riderA);
    });

    it('GET /rides/:id: for its riders, its driver and staff; only the rider sees the PIN', async () => {
      const own = await expectCall(200, 'get', `/rides/${soloRideId}`, riderA);
      expect(own.data.passengers[0].pickup_pin).toBe(soloSeat.pickup_pin);
      const staff = await expectCall(200, 'get', `/rides/${soloRideId}`, officerA);
      expect(staff.data.passengers[0]).not.toHaveProperty('pickup_pin');
      await expectCall(403, 'get', `/rides/${soloRideId}`, riderB);
      await expectCall(404, 'get', '/rides/999999', admin);
    });

    it('POST /rides/:id/accept: the first driver wins; the next gets 409', async () => {
      const body = await expectCall(200, 'post', `/rides/${soloRideId}/accept`, driver);
      expect(body.data).toMatchObject({ status: 'ACCEPTED', driverId: driver.id, vehicleId: carId });
      await expectCall(409, 'post', `/rides/${soloRideId}/accept`, otherDriver);
      await expectCall(404, 'post', '/rides/999999/accept', otherDriver);
      await expectCall(403, 'post', `/rides/${soloRideId}/accept`, riderA);
    });

    it('POST /rides/:id/arrive: the assigned driver arrives at the pickup', async () => {
      await expectCall(409, 'post', `/rides/${soloRideId}/passengers/${soloSeat.id}/pickup`, driver, {
        pin: soloSeat.pickup_pin,
      }); // not arrived yet
      const body = await expectCall(200, 'post', `/rides/${soloRideId}/arrive`, driver);
      expect(body.data).toMatchObject({ status: 'ARRIVED', passengerId: soloSeat.id });
      await expectCall(403, 'post', `/rides/${soloRideId}/arrive`, otherDriver);
    });

    it('POST /rides/:id/passengers/:pid/pickup: only with the right PIN', async () => {
      const wrongPin = soloSeat.pickup_pin === '0000' ? '1111' : '0000';
      const path = `/rides/${soloRideId}/passengers/${soloSeat.id}/pickup`;
      await expectCall(400, 'post', path, driver, { pin: wrongPin });
      await expectCall(400, 'post', path, driver, { pin: '12' });
      await expectCall(403, 'post', path, otherDriver, { pin: soloSeat.pickup_pin });
      const body = await expectCall(200, 'post', path, driver, { pin: soloSeat.pickup_pin });
      expect(body.data).toMatchObject({ rideStatus: 'IN_PROGRESS', passengerStatus: 'PICKED_UP' });
      await expectCall(409, 'post', path, driver, { pin: soloSeat.pickup_pin });
    });

    it('POST /rides/:id/sos: someone on the ride raises an alert (emailed through Mailpit)', async () => {
      const body = await expectCall(201, 'post', `/rides/${soloRideId}/sos`, riderA, { lat: pickup.lat, lng: pickup.lng });
      expect(body.data, 'is Mailpit running? (docker compose up -d)').toMatchObject({ status: 'SENT', ride_id: soloRideId });
      await expectCall(403, 'post', `/rides/${soloRideId}/sos`, riderB, {});
      await expectCall(404, 'post', '/rides/999999/sos', riderA, {});
    });

    it('POST /sos: an alert with or without a ride', async () => {
      const general = await expectCall(201, 'post', '/sos', riderB, { lat: spot.lat, lng: spot.lng });
      expect(general.data).toMatchObject({ status: 'SENT', ride_id: null });
      const onRide = await expectCall(201, 'post', '/sos', driver, { ride_id: soloRideId });
      expect(onRide.data.ride_id).toBe(soloRideId);
      await expectCall(403, 'post', '/sos', riderB, { ride_id: soloRideId });
      await expectCall(400, 'post', '/sos', riderB, { lat: 100 });
    });

    it('POST /rides/:id/passengers/:pid/dropoff: the last drop-off completes the ride', async () => {
      const path = `/rides/${soloRideId}/passengers/${soloSeat.id}/dropoff`;
      await expectCall(403, 'post', path, otherDriver);
      const body = await expectCall(200, 'post', path, driver);
      expect(body.data).toMatchObject({
        rideStatus: 'COMPLETED',
        passengerStatus: 'DROPPED',
        fareTk: soloSeat.fare_bdt,
      });
      await expectCall(409, 'post', path, driver);
    });

    it('POST /ratings: rate the other side after the trip, once per direction', async () => {
      const body = await expectCall(201, 'post', '/ratings', riderA, {
        ride_id: soloRideId, ratee_id: driver.id, score: 5, comment: 'Polite and on time',
      });
      expect(body.data).toMatchObject({ from_user_id: riderA.id, to_user_id: driver.id, stars: 5 });
      await expectCall(201, 'post', '/ratings', driver, { ride_id: soloRideId, ratee_id: riderA.id, score: 4 });
      await expectCall(409, 'post', '/ratings', riderA, { ride_id: soloRideId, ratee_id: driver.id, score: 3 });
      await expectCall(403, 'post', '/ratings', riderB, { ride_id: soloRideId, ratee_id: driver.id, score: 1 });
      await expectCall(400, 'post', '/ratings', riderA, { ride_id: soloRideId, ratee_id: riderA.id, score: 5 });
      await expectCall(400, 'post', '/ratings', riderA, { ride_id: soloRideId, ratee_id: driver.id, score: 6 });
      await expectCall(404, 'post', '/ratings', riderA, { ride_id: 999999, ratee_id: driver.id, score: 5 });
    });

    it('GET /rides/my: rides I booked, joined or drove, newest first', async () => {
      const rider = await expectCall(200, 'get', '/rides/my', riderA);
      expect(rider.data[0]).toMatchObject({ id: soloRideId, status: 'COMPLETED' });
      expect(rider.meta).toMatchObject({ page: 1, limit: 10, total: 1 });
      const drove = await expectCall(200, 'get', '/rides/my?limit=5', driver);
      expect(drove.data.some((r: Body) => r.id === soloRideId)).toBe(true);
      await expectCall(401, 'get', '/rides/my');
    });

    it('GET /rides: every ride, for Support and Admin', async () => {
      const all = await expectCall(200, 'get', '/rides?limit=50', admin);
      expect(all.data.some((r: Body) => r.id === soloRideId)).toBe(true);
      const done = await expectCall(200, 'get', '/rides?status=COMPLETED&limit=50', officerA);
      expect(done.data.every((r: Body) => r.status === 'COMPLETED')).toBe(true);
      await expectCall(403, 'get', '/rides', riderA);
      await expectCall(400, 'get', '/rides?status=FLYING', admin);
    });

    it('POST /rides/:id/cancel: riders cancel their seat, drivers the whole ride', async () => {
      const route = { origin_lat: pickup.lat, origin_lng: pickup.lng, dest_lat: farAway.lat, dest_lng: farAway.lng };
      const first = await expectCall(201, 'post', '/rides', riderA, route);
      const second = await expectCall(201, 'post', '/rides', riderA, route); // replaces the waiting one
      const replaced = await expectCall(200, 'get', `/rides/${first.data.id}`, riderA);
      expect(replaced.data).toMatchObject({ status: 'CANCELLED', cancel_reason: 'NO_DRIVER_FOUND' });

      const cancelled = await expectCall(201, 'post', `/rides/${second.data.id}/cancel`, riderA);
      expect(cancelled.data).toMatchObject({ status: 'CANCELLED', cancel_reason: 'RIDER_CANCELLED' });
      await expectCall(409, 'post', `/rides/${second.data.id}/cancel`, riderA);
      await expectCall(403, 'post', `/rides/${soloRideId}/cancel`, riderB); // not on it: 403 before any state
      await expectCall(404, 'post', '/rides/999999/cancel', riderB);

      const booked = await expectCall(201, 'post', '/rides', riderB, route);
      await expectCall(200, 'post', `/rides/${booked.data.id}/accept`, driver);
      const byDriver = await expectCall(201, 'post', `/rides/${booked.data.id}/cancel`, driver);
      expect(byDriver.data).toMatchObject({ status: 'CANCELLED', cancel_reason: 'DRIVER_CANCELLED' });
      expect(byDriver.data.passengers.every((p: Body) => p.status === 'CANCELLED')).toBe(true);
    });
  });

  // ------------------------------------------------------------------------------------------
  describe('A shared ride: offers, join requests and invites (8 endpoints)', () => {
    const joinTrip = { pickup_lat: spot.lat, pickup_lng: spot.lng, dropoff_lat: farAway.lat, dropoff_lng: farAway.lng };

    it('POST /route-offers: an online driver offers free seats on the way', async () => {
      const body = await expectCall(201, 'post', '/route-offers', driver, {
        vehicleId: carId,
        fromLat: spot.lat,
        fromLng: spot.lng,
        toLat: farAway.lat,
        toLng: farAway.lng,
        seatsOffered: 2,
        validForMinutes: 30,
      });
      expect(body.data).toMatchObject({ status: 'OPEN', rideId: null, vehicleId: carId, seatsOffered: 2 });
      offerId = body.data.id;

      const offer = { fromLat: spot.lat, fromLng: spot.lng, toLat: farAway.lat, toLng: farAway.lng, seatsOffered: 1 };
      await expectCall(409, 'post', '/route-offers', driver, { vehicleId: carId, ...offer }); // one open offer at a time
      await expectCall(403, 'post', '/route-offers', otherDriver, { vehicleId: carId, ...offer }); // not their car
      const bikes = await expectCall(200, 'get', '/vehicles/my', otherDriver);
      await expectCall(400, 'post', '/route-offers', otherDriver, { vehicleId: bikes.data[0].id, ...offer });
      await expectCall(403, 'post', '/route-offers', pendingDriver, { vehicleId: carId, ...offer });
      await expectCall(409, 'delete', `/vehicles/${carId}`, driver); // its car has an open offer
    });

    it('GET /route-offers/nearby: open offers and shared rides with free seats near a point', async () => {
      const body = await expectCall(200, 'get', `/route-offers/nearby?lat=${spot.lat}&lng=${spot.lng}&radius_km=3`, riderB);
      expect(body.data).toContainEqual(expect.objectContaining({ kind: 'ROUTE_OFFER', route_offer_id: offerId, driver_id: driver.id }));
      const far = await expectCall(200, 'get', `/route-offers/nearby?lat=${farAway.lat}&lng=${farAway.lng}&radius_km=1`, riderB);
      expect(far.data.some((o: Body) => o.route_offer_id === offerId)).toBe(false);
      await expectCall(400, 'get', '/route-offers/nearby?lat=abc', riderB);
    });

    it('POST /join-requests: a rider asks to join; the shared fare is quoted', async () => {
      const body = await expectCall(201, 'post', '/join-requests', riderB, { route_offer_id: offerId, ...joinTrip });
      expect(body.data).toMatchObject({ status: 'PENDING', initiated_by: 'RIDER', rider_id: riderB.id, driver_id: driver.id, seats: 1 });
      expect(body.data.quoted_fare_bdt).toBeLessThanOrEqual(body.data.ceiling_bdt);
      requestOfB = body.data.id;
      const fromA = await expectCall(201, 'post', '/join-requests', riderA, { route_offer_id: offerId, ...joinTrip });
      requestOfA = fromA.data.id;

      await expectCall(409, 'post', '/join-requests', riderB, { route_offer_id: offerId, ...joinTrip });
      await expectCall(400, 'post', '/join-requests', riderB, { ride_id: soloRideId, route_offer_id: offerId, ...joinTrip });
      await expectCall(400, 'post', '/join-requests', riderB, joinTrip);
      await expectCall(403, 'post', '/join-requests', otherDriver, { route_offer_id: offerId, ...joinTrip });
      await expectCall(404, 'post', '/join-requests', riderC, { route_offer_id: 999999, ...joinTrip });
      await expectCall(409, 'post', '/join-requests', riderC, { ride_id: soloRideId, ...joinTrip }); // a finished ride
    });

    it('GET /join-requests/my: requests I sent or received', async () => {
      const sent = await expectCall(200, 'get', '/join-requests/my', riderB);
      expect(sent.data.some((r: Body) => r.id === requestOfB)).toBe(true);
      const received = await expectCall(200, 'get', '/join-requests/my', driver);
      expect(received.data.map((r: Body) => r.id)).toEqual(expect.arrayContaining([requestOfA, requestOfB]));
      await expectCall(401, 'get', '/join-requests/my');
    });

    it('POST /join-requests/:id/accept: the seat transaction', async () => {
      await expectCall(403, 'post', `/join-requests/${requestOfB}/accept`, riderB); // the rider can't accept their own request
      const body = await expectCall(201, 'post', `/join-requests/${requestOfB}/accept`, driver);
      expect(body.data.status).toBe('ACCEPTED');
      expect(body.data.seat).toMatchObject({ rider_id: riderB.id, status: 'CONFIRMED' });
      await expectCall(409, 'post', `/join-requests/${requestOfB}/accept`, driver);
      await expectCall(404, 'post', '/join-requests/999999/accept', driver);

      const rides = await expectCall(200, 'get', '/rides/my', riderB);
      const ride = rides.data.find((r: Body) => r.passengers.some((p: Body) => p.join_request_id === requestOfB));
      expect(ride).toMatchObject({ is_shared: true, status: 'ACCEPTED', driver_id: driver.id, seats_total: 2, seats_free: 1 });
      sharedRideId = ride.id;
    });

    it('POST /join-requests/:id/decline: the other side says no', async () => {
      const body = await expectCall(201, 'post', `/join-requests/${requestOfA}/decline`, driver);
      expect(body.data.status).toBe('DECLINED');
      await expectCall(409, 'post', `/join-requests/${requestOfA}/decline`, driver);
      await expectCall(404, 'post', '/join-requests/999999/decline', driver);
    });

    it('POST /rides/:id/invites: the driver invites a waiting rider at the shared fare', async () => {
      const waiting = await expectCall(201, 'post', '/rides', riderC, {
        vehicle_type: 'CAR',
        is_shared: true,
        origin_lat: near(0.002, 0).lat,
        origin_lng: near(0.002, 0).lng,
        dest_lat: farAway.lat,
        dest_lng: farAway.lng,
      });
      waitingRideOfC = waiting.data.id;
      const ownSharedFare = waiting.data.passengers[0].fare_bdt;

      const body = await expectCall(201, 'post', `/rides/${sharedRideId}/invites`, driver, { waitingRideId: waitingRideOfC });
      expect(body.data).toMatchObject({ initiatedBy: 'DRIVER', riderId: riderC.id, status: 'PENDING', waitingRideId: waitingRideOfC });
      // Same formula as the rider's own shared booking (fare_rules share discount), not a different one.
      expect(body.data.quotedFareTk).toBe(ownSharedFare);
      const inviteId = body.data.id;

      await expectCall(409, 'post', `/rides/${sharedRideId}/invites`, driver, { waitingRideId: waitingRideOfC });
      await expectCall(403, 'post', `/rides/${sharedRideId}/invites`, otherDriver, { waitingRideId: waitingRideOfC });
      await expectCall(409, 'post', `/rides/${soloRideId}/invites`, driver, { waitingRideId: waitingRideOfC });

      // The rider answers the invite (the same accept endpoint, from the other side).
      await expectCall(403, 'post', `/join-requests/${inviteId}/accept`, driver);
      const accepted = await expectCall(201, 'post', `/join-requests/${inviteId}/accept`, riderC);
      expect(accepted.data.seat).toMatchObject({ rider_id: riderC.id, status: 'CONFIRMED' });
      const old = await expectCall(200, 'get', `/rides/${waitingRideOfC}`, riderC);
      expect(old.data).toMatchObject({ status: 'CANCELLED', cancel_reason: 'JOINED_ANOTHER_RIDE' });
      const ride = await expectCall(200, 'get', `/rides/${sharedRideId}`, driver);
      expect(ride.data.seats_free).toBe(0);
    });

    it('DELETE /route-offers/:id: withdraw an offer', async () => {
      await expectCall(403, 'delete', `/route-offers/${offerId}`, otherDriver);
      const body = await expectCall(200, 'delete', `/route-offers/${offerId}`, driver);
      expect(body.data.status).toBe('WITHDRAWN');
      await expectCall(409, 'delete', `/route-offers/${offerId}`, driver);
      await expectCall(404, 'delete', '/route-offers/999999', driver);
    });

    it('(flow) the shared ride: two pickups, two drop-offs, seats freed, co-riders rate', async () => {
      const seats = (await expectCall(200, 'get', `/rides/${sharedRideId}`, admin)).data.passengers;
      const pinOf = async (rider: Who) =>
        (await expectCall(200, 'get', `/rides/${sharedRideId}`, rider)).data.passengers.find((p: Body) => p.rider_id === rider.id);
      const seatB = await pinOf(riderB);
      const seatC = await pinOf(riderC);
      expect(seats).toHaveLength(2);

      await expectCall(409, 'delete', `/vehicles/${carId}`, driver); // its car is on an active ride
      expect((await expectCall(200, 'post', `/rides/${sharedRideId}/arrive`, driver)).data.passengerId).toBe(seatB.id);
      await expectCall(200, 'post', `/rides/${sharedRideId}/passengers/${seatB.id}/pickup`, driver, { pin: seatB.pickup_pin });
      expect((await expectCall(200, 'post', `/rides/${sharedRideId}/arrive`, driver)).data.passengerId).toBe(seatC.id);
      await expectCall(200, 'post', `/rides/${sharedRideId}/passengers/${seatC.id}/pickup`, driver, { pin: seatC.pickup_pin });

      const firstOff = await expectCall(200, 'post', `/rides/${sharedRideId}/passengers/${seatB.id}/dropoff`, driver);
      expect(firstOff.data).toMatchObject({ rideStatus: 'IN_PROGRESS', seatsFree: 1 });
      await expectCall(201, 'post', '/ratings', riderB, { ride_id: sharedRideId, ratee_id: riderC.id, score: 4 });
      const lastOff = await expectCall(200, 'post', `/rides/${sharedRideId}/passengers/${seatC.id}/dropoff`, driver);
      expect(lastOff.data).toMatchObject({ rideStatus: 'COMPLETED', seatsFree: 2 });
    });
  });

  // ------------------------------------------------------------------------------------------
  describe('Support: cases, strikes, appeals and the audit log (14 endpoints)', () => {
    it('POST /cases: anyone reports; OVERCHARGE needs the amount in Tk', async () => {
      const body = await expectCall(201, 'post', '/cases', riderA, {
        type: 'OVERCHARGE',
        description: 'The driver asked for Tk 300 instead of the locked fare',
        subjectId: driver.id,
        rideId: soloRideId,
        amountClaimedTk: 300,
      });
      expect(body.data).toMatchObject({ status: 'OPEN', reporter_id: riderA.id, subject_id: driver.id, amount_claimed_tk: 300 });
      expect(body.data).not.toHaveProperty('amount_claimed_paisa');
      caseId = body.data.id;

      await expectCall(400, 'post', '/cases', riderA, { type: 'OVERCHARGE', description: 'x', subjectId: driver.id });
      await expectCall(400, 'post', '/cases', riderA, { type: 'OVERCHARGE', description: 'x', subjectId: driver.id, amountClaimedTk: 0 });
      await expectCall(400, 'post', '/cases', riderA, { type: 'CONDUCT', description: 'x', amountClaimedTk: 10 });
      await expectCall(400, 'post', '/cases', riderA, { type: 'CONDUCT', description: 'x', subjectId: riderA.id });
      await expectCall(400, 'post', '/cases', riderA, { type: 'NOPE', description: 'x' });
      await expectCall(401, 'post', '/cases', null, { type: 'OTHER', description: 'x' });
    });

    it('GET /cases: the queue for Support and Admin', async () => {
      const body = await expectCall(200, 'get', '/cases?status=OPEN&limit=100', officerA);
      expect(body.data.some((c: Body) => c.id === caseId)).toBe(true);
      expect(body.data.every((c: Body) => c.status === 'OPEN')).toBe(true);
      await expectCall(200, 'get', '/cases', admin);
      await expectCall(403, 'get', '/cases', riderA);
      await expectCall(400, 'get', '/cases?status=LOST', officerA);
    });

    it('GET /cases/:id: the reporter or an officer', async () => {
      const body = await expectCall(200, 'get', `/cases/${caseId}`, riderA);
      expect(body.data.id).toBe(caseId);
      await expectCall(200, 'get', `/cases/${caseId}`, officerB);
      await expectCall(403, 'get', `/cases/${caseId}`, riderB);
      await expectCall(404, 'get', '/cases/999999', officerA);
    });

    it('PATCH /cases/:id: assign, review and uphold; a closed case is final', async () => {
      const review = await expectCall(200, 'patch', `/cases/${caseId}`, officerA, { assignedTo: officerA.id, status: 'UNDER_REVIEW' });
      expect(review.data).toMatchObject({ status: 'UNDER_REVIEW', assigned_to: officerA.id });
      await expectCall(403, 'patch', `/cases/${caseId}`, riderA, { status: 'UPHELD' });
      await expectCall(400, 'patch', `/cases/${caseId}`, officerA, { notes: 'not a field' });
      const upheld = await expectCall(200, 'patch', `/cases/${caseId}`, officerA, {
        status: 'UPHELD',
        resolution: 'The driver demanded more than the locked fare',
      });
      expect(upheld.data.status).toBe('UPHELD');
      expect(upheld.data.resolved_at).not.toBeNull();
      await expectCall(409, 'patch', `/cases/${caseId}`, officerA, { status: 'DISMISSED' });
    });

    it('DELETE /cases/:id: the reporter withdraws an open case', async () => {
      const open = await expectCall(201, 'post', '/cases', riderA, { type: 'OTHER', description: 'Left an umbrella in the car' });
      await expectCall(403, 'delete', `/cases/${open.data.id}`, riderB);
      const body = await expectCall(200, 'delete', `/cases/${open.data.id}`, riderA);
      expect(body.data.status).toBe('WITHDRAWN');
      await expectCall(409, 'delete', `/cases/${open.data.id}`, riderA);
      await expectCall(409, 'delete', `/cases/${caseId}`, officerA); // already UPHELD
    });

    it("POST /strikes: from an UPHELD case, against the case's subject", async () => {
      await expectCall(403, 'post', '/strikes', riderA, { caseId, userId: driver.id, reason: 'x' });
      await expectCall(409, 'post', '/strikes', officerA, { caseId, userId: riderB.id, reason: 'Not the subject' });
      const body = await expectCall(201, 'post', '/strikes', officerA, { caseId, userId: driver.id, reason: 'Overcharged a rider' });
      expect(body.data).toMatchObject({ status: 'ACTIVE', user_id: driver.id, issued_by: officerA.id, case_id: caseId });
      strikeId = body.data.id;
      await expectCall(409, 'post', '/strikes', officerA, { caseId, userId: driver.id, reason: 'Twice' });
      await expectCall(400, 'post', '/strikes', officerA, { caseId, userId: driver.id });
    });

    it('GET /strikes: Support and Admin; filter by user and status', async () => {
      const body = await expectCall(200, 'get', `/strikes?userId=${driver.id}&status=ACTIVE`, officerB);
      expect(body.data.map((s: Body) => s.id)).toEqual([strikeId]);
      await expectCall(403, 'get', '/strikes', driver);
      await expectCall(400, 'get', '/strikes?status=GONE', officerB);
    });

    it('GET /strikes/:id: the struck user or an officer', async () => {
      const body = await expectCall(200, 'get', `/strikes/${strikeId}`, driver);
      expect(body.data.id).toBe(strikeId);
      await expectCall(403, 'get', `/strikes/${strikeId}`, riderB);
      await expectCall(404, 'get', '/strikes/999999', officerA);
    });

    it("PATCH /strikes/:id: change an ACTIVE strike's reason or expiry", async () => {
      const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
      const body = await expectCall(200, 'patch', `/strikes/${strikeId}`, officerA, {
        reason: 'Demanded Tk 300 against the locked fare',
        expiresAt,
      });
      expect(body.data.reason).toBe('Demanded Tk 300 against the locked fare');
      expect(new Date(body.data.expires_at).toISOString()).toBe(expiresAt);
      await expectCall(400, 'patch', `/strikes/${strikeId}`, officerA, { status: 'REVOKED' });
      await expectCall(400, 'patch', `/strikes/${strikeId}`, officerA, { expiresAt: '2020-01-01' });
      await expectCall(403, 'patch', `/strikes/${strikeId}`, driver, { reason: 'Mine now' });
    });

    it('POST /strikes/:id/appeals: the struck user appeals once', async () => {
      await expectCall(403, 'post', `/strikes/${strikeId}/appeals`, riderA, { statement: 'Not my strike' });
      const body = await expectCall(201, 'post', `/strikes/${strikeId}/appeals`, driver, {
        statement: 'The rider agreed to pay the bridge toll on top of the fare',
      });
      expect(body.data).toMatchObject({ status: 'PENDING', strike_id: strikeId });
      appealId = body.data.id;
      await expectCall(409, 'post', `/strikes/${strikeId}/appeals`, driver, { statement: 'Again' });
      await expectCall(400, 'post', `/strikes/${strikeId}/appeals`, driver, {});
    });

    it('PATCH /appeals/:id: another officer decides; accepting overturns the strike', async () => {
      await expectCall(403, 'patch', `/appeals/${appealId}`, officerA, { status: 'ACCEPTED', decisionReason: 'Own strike' });
      await expectCall(403, 'patch', `/appeals/${appealId}`, driver, { status: 'ACCEPTED', decisionReason: 'Mine' });
      await expectCall(400, 'patch', `/appeals/${appealId}`, officerB, { status: 'MAYBE', decisionReason: 'x' });
      const body = await expectCall(200, 'patch', `/appeals/${appealId}`, officerB, {
        status: 'ACCEPTED',
        decisionReason: 'The toll receipt was provided',
      });
      expect(body.data).toMatchObject({ status: 'ACCEPTED', decided_by: officerB.id });
      const strike = await expectCall(200, 'get', `/strikes/${strikeId}`, officerA);
      expect(strike.data.status).toBe('OVERTURNED');
      await expectCall(409, 'patch', `/appeals/${appealId}`, officerB, { status: 'REJECTED', decisionReason: 'x' });
      await expectCall(404, 'patch', '/appeals/999999', officerB, { status: 'REJECTED', decisionReason: 'x' });
    });

    it('DELETE /strikes/:id: revoke an ACTIVE strike', async () => {
      // A second upheld case and strike, this time against a co-rider.
      const report = await expectCall(201, 'post', '/cases', riderC, {
        type: 'CONDUCT', description: 'Rude to me during the shared ride', subjectId: riderB.id, rideId: sharedRideId,
      });
      await expectCall(200, 'patch', `/cases/${report.data.id}`, officerB, {
        assignedTo: officerB.id, status: 'UPHELD', resolution: 'Confirmed by the driver',
      });
      const strike = await expectCall(201, 'post', '/strikes', officerB, {
        caseId: report.data.id, userId: riderB.id, reason: 'Rude to a co-rider',
      });
      await expectCall(403, 'delete', `/strikes/${strike.data.id}`, riderB);
      const body = await expectCall(200, 'delete', `/strikes/${strike.data.id}`, officerA);
      expect(body.data.status).toBe('REVOKED');
      expect(body.data.revoked_at).not.toBeNull();
      await expectCall(409, 'delete', `/strikes/${strike.data.id}`, officerA);
      await expectCall(409, 'delete', `/strikes/${strikeId}`, officerA); // already OVERTURNED
    });

    it('GET /audit-logs: every support change, newest first, with cursor paging', async () => {
      const body = await expectCall(200, 'get', '/audit-logs?entity=strikes&limit=5', officerA);
      expect(body.data).toHaveLength(5);
      expect(body.data.every((e: Body) => e.entity === 'strikes')).toBe(true);
      const actions = (await expectCall(200, 'get', `/audit-logs?userId=${officerB.id}&limit=100`, admin)).data.map((e: Body) => e.action);
      expect(actions).toEqual(expect.arrayContaining(['APPEAL_DECIDED', 'STRIKE_OVERTURNED', 'STRIKE_ISSUED', 'CASE_UPDATED']));
      const last = body.data[body.data.length - 1].id;
      const older = await expectCall(200, 'get', `/audit-logs?cursor=${last}&limit=5`, officerA);
      expect(older.data.every((e: Body) => BigInt(e.id) < BigInt(last))).toBe(true);
      await expectCall(403, 'get', '/audit-logs', riderA);
      await expectCall(400, 'get', '/audit-logs?from=yesterday', officerA);
    });

    it('GET /audit-logs/:id: one entry with its old and new values', async () => {
      const [latest] = (await expectCall(200, 'get', `/audit-logs?entity=appeals&userId=${officerB.id}&limit=1`, officerA)).data;
      const body = await expectCall(200, 'get', `/audit-logs/${latest.id}`, admin);
      expect(body.data).toMatchObject({ id: latest.id, action: 'APPEAL_DECIDED' });
      expect(body.data.old_value.status).toBe('PENDING');
      expect(body.data.new_value.status).toBe('ACCEPTED');
      await expectCall(400, 'get', '/audit-logs/abc', admin);
      await expectCall(404, 'get', '/audit-logs/99999999', admin);
      await expectCall(400, 'get', '/audit-logs/99999999999999999999', admin);
      await expectCall(403, 'get', `/audit-logs/${latest.id}`, driver);
    });
  });
});
