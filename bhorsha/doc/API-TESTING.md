# Testing the 55 endpoints

Two ways: one command that checks every endpoint, or a walk through Swagger UI that calls each one by hand.

**Contents:** [1. One command](#1-one-command) · [2. By hand in Swagger](#2-by-hand-in-swagger) · [3. Checklist](#3-checklist-of-all-55) · [4. Reading the answers](#4-reading-the-answers)

## 1. One command

You need the database and Mailpit running (`docker compose up -d`) and a `.env` (see the [README](../README.md#quick-start)).

```bash
pnpm test:endpoints
```

It runs [`test/all-endpoints.e2e-spec.ts`](../test/all-endpoints.e2e-spec.ts): one test per endpoint (55) plus one test for the whole shared-ride flow, in about 10 seconds. Each test calls its endpoint the way a client does (real login tokens, `/api/v1`, validation, the response envelope), first the normal answer, then the main refusals (401, 403, 404, 409, 400). When a test fails, the message shows the request and the full response body.

It only needs the seed admin (`+8801700000001` / `Bhorsha@123`). Every other account, vehicle, ride and case is created by the test, so you can run it again and again. It does add rows on every run, so for a clean run use a throwaway database on port 5434 instead of your dev data:

```bash
docker run -d --name bhorsha-db-test -p 5434:5432 \
  -e POSTGRES_DB=bhorsha -e POSTGRES_USER=bhorsha -e POSTGRES_PASSWORD=bhorsha123 \
  siam001/bhorsha-db:2.0.0
# wait about 10 seconds for the demo data to load, then:
DB_PORT=5434 pnpm test:endpoints
docker rm -f bhorsha-db-test        # delete it when you're done
```

| Command | Runs |
|---|---|
| `pnpm test` | Unit tests (no database) |
| `pnpm test:endpoints` | All 55 endpoints, end to end |
| `pnpm test:concurrency` | 50 riders racing for the last seat; exactly one may win |
| `pnpm test:e2e` | Every `test/*.e2e-spec.ts` file |

## 2. By hand in Swagger

### Before you start

1. Add these two lines to `.env` and restart the API. Join requests otherwise expire after 12 seconds, and tokens after 15 minutes, which is too fast for clicking through Swagger:

   ```text
   RIDER_REQUEST_TTL_SECONDS=600
   JWT_ACCESS_TTL=2h
   ```

2. `docker compose up -d`, then `pnpm start:dev`.
3. Open Swagger at `http://localhost:3000/api/docs` (use the `PORT` from your `.env`). SOS emails arrive in Mailpit at http://localhost:8025.
4. Optional: `docker compose down -v && docker compose up -d` resets the database to the demo data. **This deletes everything in your local database.**

### Switching users

Most steps say who to be. To become that user:

1. Run `POST /auth/login` with their phone and password and copy `data.accessToken`.
2. Click **Authorize** (top right), click **Logout** if a token is already there, paste the new token (without the word `Bearer`) and click **Authorize**.

Keep the tokens in a text file, so you can switch back without logging in again.

These seed accounts already exist (password `Bhorsha@123` for all):

| Who | Phone | id |
|---|---|---|
| Admin | `+8801700000001` | 1 |
| Support Officer Farhana | `+8801700000002` | 2 |
| Support Officer Mahmud | `+8801700000010` | 10 |
| Driver Karim (car, verified) | `+8801911000005` | 5 |

You create four more yourself in step A: **Rider R1**, **Rider R2**, **Rider R3** and **Driver D**. Use phone numbers nobody has used yet, for example `+88019` and any 8 digits. Write down the `id` each one gets.

Replace `{…}` with the ids you got from earlier steps. Every response puts its content in `data`.

### A. Accounts and admin (11 endpoints)

| # | As | Call | Body or parameters | Expect |
|---|---|---|---|---|
| 1 | nobody | `POST /auth/register` | `{"fullName":"Rider R1","phone":"+8801955550001","password":"Bhorsha@123","role":"RIDER"}`. Repeat for R2 and R3 with other phones | 201. No password in the answer |
| 2 | nobody | `POST /auth/register` | `{"fullName":"Driver D","phone":"+8801955550004","password":"Bhorsha@123","role":"DRIVER","licenceNo":"DK-55550004"}` | 201, `driverProfile.verification` = `PENDING`. The same phone again: 409 |
| 3 | nobody | `POST /auth/login` | `{"phone":"+8801700000001","password":"Bhorsha@123"}` | 200 with `accessToken`. A wrong password: 401 |
| 4 | Admin | `GET /users` | `role=DRIVER`, `status=ACTIVE`, `limit=10` | 200, a page with `meta.total`. As R1: 403. Without a token: 401 |
| 5 | Admin | `GET /users/{id}` | id = R1 | 200 |
| 6 | Admin | `POST /users` | `{"fullName":"Test Officer","phone":"+8801955550005","password":"Bhorsha@123","role":"SUPPORT"}` | 201. `role` RIDER: 400 |
| 7 | R1 | `PATCH /users/{id}` | id = R1, `{"fullName":"Rider One"}` | 200. As R1 with `{"role":"ADMIN"}`: 403 |
| 8 | Admin | `DELETE /users/{id}` | id = Test Officer | 204. Logging in as Test Officer now gives 403 |
| 9 | Admin | `GET /drivers` | `verification=PENDING` | 200; Driver D is in the queue (oldest first, so maybe on a later page) |
| 10 | Admin | `PATCH /drivers/{id}/verify` | id = D, `{"verification":"VERIFIED"}` | 200. `REJECTED` needs `rejectionReason` |
| 11 | Admin | `GET /fare-rules` | | 200, three rules in Tk. Note the CAR rule's `id` |
| 12 | Admin | `PATCH /fare-rules/{id}` | CAR id, `{"baseTk":85}`, then put back the `baseTk` you saw in #11 | 200 both times. Above `ceilingBaseTk`: 409 |

### B. Driver setup (8 endpoints), as Driver D

| # | Call | Body or parameters | Expect |
|---|---|---|---|
| 13 | `GET /drivers/me` | | 200, `VERIFIED`, `OFFLINE`. As R1: 403 |
| 14 | `POST /vehicles` | `{"type":"CAR","regNo":"DHAKA METRO-GA 55-5501"}` | 201, `seats` 3. Note the car's `id`. The same `regNo` again: 409 |
| 15 | `POST /vehicles` | `{"type":"BIKE","regNo":"DHAKA METRO-HA 55-5502"}` | 201, `seats` 1. Note the bike's `id` |
| 16 | `GET /vehicles/my` | | 200, both vehicles |
| 17 | `GET /vehicles/{id}` | the car | 200. As Karim: 403 |
| 18 | `PATCH /vehicles/{id}` | the bike, `{"regNo":"DHAKA METRO-HA 55-5503"}` | 200 |
| 19 | `DELETE /vehicles/{id}` | the bike | 204; it no longer shows in `GET /vehicles/my` |
| 20 | `PATCH /drivers/me/status` | `{"status":"ONLINE"}` | 200 (an unverified driver gets 403) |
| 21 | `PUT /drivers/me/location` | `{"lat":23.7937,"lng":90.4066}` | 200 |

### C. A solo ride (14 endpoints)

| # | As | Call | Body or parameters | Expect |
|---|---|---|---|---|
| 22 | R1 | `GET /rides/quote` | `vehicle_type=CAR`, `distance_km=10`, `is_shared=false` | 200. With the demo tariff: `total_fare_bdt` 260, `shared_fare_bdt` 195, `brta_ceiling_bdt` 357. `vehicle_type=TRUCK`: 400 |
| 23 | R1 | `POST /rides` | `{"origin":"Banani 11","destination":"Gulshan 1","vehicle_type":"CAR","origin_lat":23.7945,"origin_lng":90.4071,"dest_lat":23.7808,"dest_lng":90.4168}` | 201, `REQUESTED`. Note `data.id` (the ride), `passengers[0].id` (the seat) and `passengers[0].pickup_pin` |
| 24 | D | `GET /rides/open` | | 200; R1's ride is in the list (requests within 3 km, from the last 10 minutes) |
| 25 | R1 | `GET /rides/{id}` | the ride | 200 with your PIN. As R2: 403 |
| 26 | D | `POST /rides/{id}/accept` | the ride | 200, `ACCEPTED`. Karim accepting it too: 409 |
| 27 | D | `POST /rides/{id}/arrive` | the ride | 200, `ARRIVED` |
| 28 | D | `POST /rides/{id}/passengers/{pid}/pickup` | ride, seat, `{"pin":"<R1's PIN>"}` | 200, ride `IN_PROGRESS`. A wrong PIN: 400 |
| 29 | R1 | `POST /rides/{id}/sos` | the ride, `{"lat":23.79,"lng":90.41}` | 201, `SENT`; the email is in Mailpit |
| 30 | R2 | `POST /sos` | `{}` | 201, `ride_id` null |
| 31 | D | `POST /rides/{id}/passengers/{pid}/dropoff` | ride, seat | 200, ride `COMPLETED`, `fareTk` = the locked fare |
| 32 | R1 | `POST /ratings` | `{"ride_id":<ride>,"ratee_id":<D>,"score":5,"comment":"Smooth ride"}` | 201. The same rating again: 409 |
| 33 | R1 | `GET /rides/my` | | 200, the ride, newest first |
| 34 | Farhana or Admin | `GET /rides` | `status=COMPLETED` | 200. As R1: 403 |
| 35 | R1 | `POST /rides`, then `POST /rides/{id}/cancel` | the same body as #23; cancel the new ride | 201, `CANCELLED`, `RIDER_CANCELLED`. Cancel again: 409 |

### D. A shared ride (8 endpoints)

| # | As | Call | Body or parameters | Expect |
|---|---|---|---|---|
| 36 | D | `POST /route-offers` | `{"vehicleId":<car>,"fromLat":23.7937,"fromLng":90.4066,"toLat":23.7461,"toLng":90.3742,"seatsOffered":2}` | 201, `OPEN`. Note its `id`. A second offer: 409 |
| 37 | R2 | `GET /route-offers/nearby` | `lat=23.7937`, `lng=90.4066`, `radius_km=3` | 200; D's offer, `kind` `ROUTE_OFFER` |
| 38 | R2 | `POST /join-requests` | `{"route_offer_id":<offer>,"pickup_lat":23.7937,"pickup_lng":90.4066,"dropoff_lat":23.7502,"dropoff_lng":90.3801}` | 201, `PENDING`, with `quoted_fare_bdt` |
| 39 | R1 | `POST /join-requests` | the same body | 201 (a second request, to decline) |
| 40 | D | `GET /join-requests/my` | | 200; both requests |
| 41 | D | `POST /join-requests/{id}/accept` | R2's request | 201, `ACCEPTED`, with R2's `seat`. A shared ride now exists: `GET /rides/my` as D shows it first; note its `id` |
| 42 | D | `POST /join-requests/{id}/decline` | R1's request | 201, `DECLINED` |
| 43 | R3 | `POST /rides` | `{"vehicle_type":"CAR","is_shared":true,"origin_lat":23.7950,"origin_lng":90.4060,"dest_lat":23.7510,"dest_lng":90.3810}` | 201. Note this waiting ride's `id` |
| 44 | D | `POST /rides/{id}/invites` | the shared ride, `{"waitingRideId":<R3's ride>}` | 201, `initiatedBy` `DRIVER`, `quotedFareTk` = R3's own shared fare |
| 45 | R3 | `POST /join-requests/{id}/accept` | the invite's `id` | 201; R3 has a seat, R3's own booking is `CANCELLED` (`JOINED_ANOTHER_RIDE`) |
| 46 | D | `DELETE /route-offers/{id}` | the offer | 200, `WITHDRAWN` |

To finish the shared ride, as D: `arrive`, `pickup` R2 (with R2's PIN from `GET /rides/{id}` as R2), `arrive`, `pickup` R3, then `dropoff` each. After the last drop-off the ride is `COMPLETED`.

### E. Support (14 endpoints)

| # | As | Call | Body or parameters | Expect |
|---|---|---|---|---|
| 47 | R1 | `POST /cases` | `{"type":"OVERCHARGE","description":"Asked for Tk 300","subjectId":<D>,"rideId":<solo ride>,"amountClaimedTk":300}` | 201, `OPEN`. Without `amountClaimedTk`: 400 |
| 48 | Farhana | `GET /cases` | `status=OPEN` | 200. As R1: 403 |
| 49 | R1 | `GET /cases/{id}` | the case | 200 (the reporter or an officer). As R2: 403 |
| 50 | Farhana | `PATCH /cases/{id}` | `{"assignedTo":2,"status":"UNDER_REVIEW"}`, then `{"status":"UPHELD","resolution":"Charged above the locked fare"}` | 200 both times. Once UPHELD, any change: 409 |
| 51 | R1 | `POST /cases`, then `DELETE /cases/{id}` | `{"type":"OTHER","description":"Lost an umbrella"}`; withdraw it | 201, then 200 `WITHDRAWN` |
| 52 | Farhana | `POST /strikes` | `{"caseId":<case>,"userId":<D>,"reason":"Overcharged a rider"}` | 201, `ACTIVE`. Again: 409 |
| 53 | Farhana | `GET /strikes` | `userId=<D>` | 200 |
| 54 | D | `GET /strikes/{id}` | the strike | 200 (the struck user or an officer) |
| 55 | Farhana | `PATCH /strikes/{id}` | `{"reason":"Demanded Tk 300 against the locked fare"}` | 200 |
| 56 | D | `POST /strikes/{id}/appeals` | `{"statement":"The rider agreed to pay the toll"}` | 201, `PENDING`. Note its `id` |
| 57 | Farhana | `PATCH /appeals/{id}` | `{"status":"ACCEPTED","decisionReason":"Receipt shown"}` | **403**: she issued the strike |
| 58 | Mahmud | `PATCH /appeals/{id}` | the same body | 200; `GET /strikes/{id}` now shows `OVERTURNED` |
| 59 | Farhana | `DELETE /strikes/{id}` | an `ACTIVE` strike, e.g. the demo strike 2 | 200, `REVOKED`. An overturned strike: 409 |
| 60 | Farhana | `GET /audit-logs` | `entity=strikes`, `limit=10` | 200, newest first. Pass the last `id` as `cursor` for older ones |
| 61 | Farhana | `GET /audit-logs/{id}` | an id from #60 | 200 with `old_value` and `new_value` |

## 3. Checklist of all 55

"Who" is who may call it; the code is the success answer.

| Endpoint | Who | OK |
|---|---|---|
| `POST /auth/register` | anyone | 201 |
| `POST /auth/login` | anyone | 200 |
| `GET /users` | Admin | 200 |
| `GET /users/:id` | Admin | 200 |
| `POST /users` | Admin | 201 |
| `PATCH /users/:id` | owner or Admin | 200 |
| `DELETE /users/:id` | Admin | 204 |
| `GET /drivers` | Admin | 200 |
| `PATCH /drivers/:id/verify` | Admin | 200 |
| `GET /fare-rules` | Admin | 200 |
| `PATCH /fare-rules/:id` | Admin | 200 |
| `GET /drivers/me` | driver | 200 |
| `PATCH /drivers/me/status` | driver | 200 |
| `PUT /drivers/me/location` | driver | 200 |
| `POST /vehicles` | driver | 201 |
| `GET /vehicles/my` | driver | 200 |
| `GET /vehicles/:id` | owner | 200 |
| `PATCH /vehicles/:id` | owner | 200 |
| `DELETE /vehicles/:id` | owner | 204 |
| `GET /rides/open` | online driver | 200 |
| `POST /rides/:id/accept` | online driver | 200 |
| `POST /rides/:id/arrive` | the ride's driver | 200 |
| `POST /rides/:id/passengers/:pid/pickup` | the ride's driver | 200 |
| `POST /rides/:id/passengers/:pid/dropoff` | the ride's driver | 200 |
| `POST /route-offers` | online driver | 201 |
| `DELETE /route-offers/:id` | owner | 200 |
| `POST /rides/:id/invites` | the ride's driver | 201 |
| `GET /rides/quote` | logged in | 200 |
| `POST /rides` | rider | 201 |
| `GET /rides/my` | logged in | 200 |
| `GET /rides` | Support or Admin | 200 |
| `GET /rides/:id` | its riders, its driver, Support or Admin | 200 |
| `POST /rides/:id/cancel` | its rider or driver | 201 |
| `GET /route-offers/nearby` | logged in | 200 |
| `POST /join-requests` | rider | 201 |
| `GET /join-requests/my` | logged in | 200 |
| `POST /join-requests/:id/accept` | the other side (driver for a request, rider for an invite) | 201 |
| `POST /join-requests/:id/decline` | the other side | 201 |
| `POST /ratings` | someone who took the ride | 201 |
| `POST /rides/:id/sos` | its riders or driver | 201 |
| `POST /sos` | logged in | 201 |
| `POST /cases` | logged in | 201 |
| `GET /cases` | Support or Admin | 200 |
| `GET /cases/:id` | reporter, Support or Admin | 200 |
| `PATCH /cases/:id` | Support or Admin | 200 |
| `DELETE /cases/:id` | reporter, Support or Admin | 200 |
| `POST /strikes` | Support or Admin | 201 |
| `GET /strikes` | Support or Admin | 200 |
| `GET /strikes/:id` | struck user, Support or Admin | 200 |
| `PATCH /strikes/:id` | Support or Admin | 200 |
| `DELETE /strikes/:id` | Support or Admin | 200 |
| `POST /strikes/:id/appeals` | struck user | 201 |
| `PATCH /appeals/:id` | Support or Admin, not the issuer | 200 |
| `GET /audit-logs` | Support or Admin | 200 |
| `GET /audit-logs/:id` | Support or Admin | 200 |

## 4. Reading the answers

| You get | It means |
|---|---|
| 400 `VALIDATION_FAILED` | The body or query is wrong; `error.details` names each field |
| 400 `BAD_REQUEST` | Other bad input, such as an id above 2147483647 or a value in the wrong format |
| 401 | No token, an expired one, or the account was deactivated: log in again |
| 403 | Logged in, but this isn't yours or needs another role |
| 404 | No such ride, user, case… |
| 409 | The data doesn't allow it right now: already accepted, no seat left, a taken phone or registration number, above the legal ceiling, wrong state |
| 503 | SOS email could not be sent: start Mailpit (`docker compose up -d`) |
| 500 | A bug. Find the `requestId` from the answer in the API's terminal output |

Join requests and invites expire (`RIDER_REQUEST_TTL_SECONDS`, 12 s by default). An expired one shows as `EXPIRED` in `GET /join-requests/my` and answering it gives 409.
