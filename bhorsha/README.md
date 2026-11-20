# Bhorsha API

The NestJS backend of Bhorsha, the fair ride-hailing and ride-sharing platform for Dhaka. This folder is the CSC4161 course release of Architecture v3.1: a backend-only API, shown through Swagger UI and Postman and built around driver-to-rider requests.

The architecture, the 54 planned endpoints and the work split are in the [main README](../README.md), especially [§26 CSC4161 Course Release](../README.md#26-csc4161-course-release). Every table, constraint and trigger of the database is in [doc/databaseSQL.md](doc/databaseSQL.md).

**Contents:** [Quick start](#quick-start) · [Environment variables](#environment-variables) · [Logging in](#logging-in) · [How requests and errors look](#how-requests-and-errors-look) · [Endpoints](#endpoints) · [Project structure](#project-structure) · [Adding an endpoint](#adding-an-endpoint) · [Scripts and tests](#scripts-and-tests) · [Troubleshooting](#troubleshooting) · [Status and known issues](#status-and-known-issues) · [Team workflow](#team-workflow)

## Quick start

You need Node.js 20.19+, 22.13+ or 24.11+ (TypeORM 1.x needs one of these), pnpm, and Docker Desktop. Run everything inside this `bhorsha/` folder.

**1. Install the packages.**

```bash
pnpm install
```

**2. Create your `.env` from the template.** `.env` is git-ignored, so your copy stays on your computer.

```bash
cp .env.example .env
```

On Windows: `copy .env.example .env`

**3. Set your own JWT secret.** The server signs login tokens with it, and it won't start without one. Make a random value:

```bash
openssl rand -base64 32
```

If you don't have `openssl` (Windows):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put the value in `.env`, replacing `change-me-to-a-long-random-string`:

```text
JWT_ACCESS_SECRET=the-value-you-just-made
```

**4. Start the database.** The first run downloads the image, which already holds the 13 tables and demo data.

```bash
docker compose up -d
```

Wait until `docker compose ps` shows `bhorsha-db` as `(healthy)`.

**5. Start the API.**

```bash
pnpm start:dev
```

**6. Open Swagger** at http://localhost:3000/api/docs and log in with a [demo account](#demo-accounts).

| What | Where |
|---|---|
| API | http://localhost:3000/api/v1 |
| Swagger UI | http://localhost:3000/api/docs (raw OpenAPI JSON: `/api/docs-json`) |
| Mailpit (SOS emails) | http://localhost:8025 |
| Database | `localhost:5433`, database `bhorsha`, user `bhorsha`, password `bhorsha123` ([DBeaver guide](doc/Photos/Database%20Connection%20On%20Docker%20and%20DBeaver/Approach.md)) |

To start over with fresh demo data, delete the database volume and start again. This deletes everything in your local database:

```bash
docker compose down -v
```

## Environment variables

`.env.example` lists every variable with a working local value. Only `JWT_ACCESS_SECRET` must be changed.

| Variable | Value in `.env.example` | What it does |
|---|---|---|
| `PORT` | `3000` | Port the API listens on |
| `DB_IMAGE` | `siam001/bhorsha-db:2.0.0` | Database image that `docker compose` runs |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | `bhorsha`, `bhorsha`, `bhorsha123` | Database that `docker compose` creates |
| `DB_HOST`, `DB_PORT` | `localhost`, `5433` | Where the API finds the database. **Required** |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | `bhorsha`, `bhorsha123`, `bhorsha` | The API's database login. `DB_USER` and `DB_NAME` are **required** |
| `DB_POOL_MAX`, `DB_LOGGING` | `10`, `false` | Connection pool size; `true` logs every SQL query |
| `DATABASE_URL` | `postgresql://…@localhost:5433/bhorsha` | The same connection as one URL, for DBeaver or TablePlus. The API doesn't read it |
| `NODE_ENV` | `development` | `production` turns the `x-user-id` fallback off for good |
| `JWT_ACCESS_SECRET` | placeholder | Signs login tokens. **Required**; use your own random value |
| `JWT_ACCESS_TTL` | `15m` | How long a token stays valid |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost |
| `ALLOW_X_USER_ID` | `false` | **Dev only.** `true` lets a request without a token use the `x-user-id` header ([details](#the-x-user-id-header-dev-only)) |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_FROM` | `localhost`, `1025`, `emergency@bhorsha.com` | SMTP server for SOS emails (Mailpit locally) |
| `REDIS_HOST`, `REDIS_PORT` | `localhost`, `6379` | Not used by the code yet |

The API checks the required values at start-up (`src/config/env.validation.ts`) and refuses to start if one is missing. Values set in the shell win over `.env`, so `PORT=3100 pnpm start:dev` works for a one-off change.

## Logging in

### Demo accounts

They come with the database image. Every password is `Bhorsha@123`, and you log in with the phone number. The full list (13 accounts) and demo scenarios are in [main README §20](../README.md#20-getting-started).

| Role | Name | Phone |
|---|---|---|
| ADMIN | Bhorsha Admin | `+8801700000001` |
| SUPPORT | Farhana Islam | `+8801700000002` |
| RIDER | Nusrat Jahan | `+8801711000003` |
| DRIVER (car, verified) | Karim Mia | `+8801911000005` |
| DRIVER (bike, not verified) | Shakil Khan | `+8801311000008` |

### Get a token and use it

```bash
curl -X POST http://localhost:3000/api/v1/auth/login -H "Content-Type: application/json" -d '{"phone":"+8801700000001","password":"Bhorsha@123"}'
```

The answer holds `data.accessToken`. Send it on every other request:

```bash
curl http://localhost:3000/api/v1/users -H "Authorization: Bearer PASTE_THE_TOKEN_HERE"
```

**In Swagger:** run `POST /auth/login`, copy `accessToken`, click **Authorize** at the top, paste it (without the word `Bearer`) and close the dialog. Every request you try after that carries the token.

- A token lasts `JWT_ACCESS_TTL` (15 minutes). After that you get 401 `Access token expired`; log in again.
- New riders and drivers sign up with `POST /auth/register`. Admin and Support Officer accounts are created by an admin with `POST /users`.
- Each developer has their own `JWT_ACCESS_SECRET`, so a token from one computer doesn't work on another.

### How access is checked

Two global guards run on every request, in this order:

1. **JwtAuthGuard** checks who you are. Every route needs a valid Bearer token, except routes marked `@Public()` (`POST /auth/register`, `POST /auth/login`, `GET /`). The guard reloads the user from the database on every request, so a role change or a deactivation applies at once, even to a token that was issued earlier.
2. **RolesGuard** checks what you may do. A route marked `@Roles(Role.ADMIN)` is open only to admins, with no implicit pass for other roles. A route without `@Roles()` is open to any logged-in user, and its service decides who may act (for example, only the owner of a vehicle can edit it).

| Answer | Meaning |
|---|---|
| 401 `Missing or invalid access token` | No token, a broken one, or one signed with another secret |
| 401 `Access token expired` | Log in again |
| 401 `Account not found or deactivated` | The account behind the token was deactivated |
| 403 `You do not have permission to do this` | Logged in, but the route needs another role |

After the guards, `request.user` is `{ id, role, suspendedUntil }`.

### The `x-user-id` header (dev only)

Before login existed, endpoints read the user from an `x-user-id` header. While you build and test, you can keep doing that:

- With `ALLOW_X_USER_ID=true` in `.env`, a request **without** an `Authorization` header may send `x-user-id: 5` instead. The user is still loaded from the database, so the role is the real one and deactivated accounts are refused.
- A Bearer token always wins when both are sent.
- It never works when `NODE_ENV=production`. The API logs a warning at start-up while the flag is on.
- **Set it to `false` for the demo and the submission.** Anyone can type any id into a header.

## How requests and errors look

- Every route is under `/api/v1`.
- Request bodies and query strings are checked against a DTO. Unknown fields are refused with 400.
- Money is in **Tk** in every request and response (up to 2 decimals); the database stores whole paisa (Tk 1 = 100 paisa). Times are UTC.
- `password_hash` never appears in a response.

**Success** (the response envelope from `TransformInterceptor`):

```json
{ "success": true, "message": "OK", "data": { "id": 7, "fullName": "Rahim Uddin" }, "meta": {} }
```

`message` is `Created` for a 201. A 204 has no body. Lists are paginated with `?page=1&limit=10` (`limit` is at most 50) and put the page in `meta`:

```json
{ "success": true, "message": "OK", "data": [ ... ], "meta": { "page": 1, "limit": 10, "total": 42 } }
```

**Errors** (one global filter, `src/common/filters/all-exceptions.filter.ts`):

```json
{
  "success": false,
  "error": { "code": "CONFLICT", "message": "Phone number already registered", "details": null },
  "meta": { "requestId": "1b560729-d131-44e0-9533-d167af2c585a" }
}
```

A failed validation lists every field:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Validation failed",
    "details": [
      { "field": "phone", "messages": ["phone must look like +8801712345678"] },
      { "field": "password", "messages": ["password must be longer than or equal to 8 characters"] }
    ]
  },
  "meta": { "requestId": "…" }
}
```

| HTTP | `error.code` | When |
|---|---|---|
| 400 | `VALIDATION_FAILED` | The body or query doesn't match the DTO; `details` lists the fields |
| 400 | `BAD_REQUEST` | Other bad input, such as a non-numeric id, or a number the database can't hold (an id above 2147483647) |
| 401 | `UNAUTHORIZED` | Not logged in (see the table above) |
| 403 | `FORBIDDEN` | Wrong role, someone else's resource, or a deactivated account at login |
| 404 | `NOT_FOUND` | No such record or route |
| 409 | `CONFLICT` | A database rule refused the change: a taken phone, email, licence or registration number, a full ride, a wrong ride state, a fare above the legal ceiling |
| 409 | `BUSY` | Deadlock or lock timeout; retry the request |
| 500 | `INTERNAL_SERVER_ERROR` | A bug. The body never contains the stack trace or SQL; the server log has them, under the same `requestId` |

The filter turns PostgreSQL errors 23505, 23503 and 23514 into these 409s by constraint name. The friendly messages come from [databaseSQL.md §10](doc/databaseSQL.md#10-error-map-for-the-global-exception-filter) and live in `src/common/filters/database-error.map.ts`. Values the database can't parse (22003 out of range, 22P02 wrong format) become 400.

## Endpoints

55 routes: the 54 of §26 plus `POST /sos`. Swagger has the request and response fields of each one. "Access" is what §26 specifies. To test them all, see [doc/API-TESTING.md](doc/API-TESTING.md): one command (`pnpm test:endpoints`) or a step-by-step Swagger walkthrough.

### Admin: Siam (`src/modules/identity`, `src/modules/pricing`)

| Method | Path | Access | What it does |
|---|---|---|---|
| POST | `/auth/register` | Public | Register a rider, or a driver with `licenceNo`. A driver's user and driver profile are created in one transaction |
| POST | `/auth/login` | Public | Phone and password; returns a JWT access token |
| GET | `/users` | Admin | List users; filter `role` and `status` (`ACTIVE`, `SUSPENDED`, `DEACTIVATED`) |
| GET | `/users/:id` | Admin | One user |
| POST | `/users` | Admin | Create an Admin or Support Officer account |
| PATCH | `/users/:id` | Owner or Admin | Owner: `fullName`, `email`. Admin also: `role`, `isActive`, `suspendedUntil`. Nobody can switch into or out of DRIVER, and an admin can't demote, deactivate or suspend themselves |
| DELETE | `/users/:id` | Admin | Deactivate (never deletes); a driver is also set OFFLINE |
| GET | `/drivers` | Admin | List drivers; filter `verification`. The PENDING queue is oldest first |
| PATCH | `/drivers/:id/verify` | Admin | `VERIFIED`, or `REJECTED` with a `rejectionReason`. Rejecting also sets the driver OFFLINE |
| GET | `/fare-rules` | Admin | The fare rule for each vehicle type |
| PATCH | `/fare-rules/:id` | Admin | Change `baseTk`, `perKmTk` or `shareDiscountPercent` (amounts in Tk). Above the legal ceiling → 409; the ceiling itself can't be changed → 400 |

### Driver: Sumaiya Akter Roshni (`src/modules/fleet`, `trips`, `sharing`)

| Method | Path | Access | What it does |
|---|---|---|---|
| GET | `/drivers/me` | Driver | Own driver profile |
| PATCH | `/drivers/me/status` | Driver | Go `ONLINE` or `OFFLINE`; only a verified driver can go online |
| PUT | `/drivers/me/location` | Driver | Post the current location |
| POST | `/vehicles` | Driver | Add a vehicle; seats come from the type |
| GET | `/vehicles/my` | Driver | Own vehicles |
| GET | `/vehicles/:id` | Owner driver | One vehicle |
| PATCH | `/vehicles/:id` | Owner driver | Update a vehicle |
| DELETE | `/vehicles/:id` | Owner driver | Soft delete; 409 if it's on an active ride or open offer |
| GET | `/rides/open` | Driver | Open requests within 3 km |
| POST | `/rides/:id/accept` | Driver | Accept; the first accept wins (row lock), the others get 409 |
| POST | `/rides/:id/arrive` | Assigned driver | Arrived at the next pickup |
| POST | `/rides/:id/passengers/:pid/pickup` | Assigned driver | Pick up with the passenger's PIN |
| POST | `/rides/:id/passengers/:pid/dropoff` | Assigned driver | Drop off; the ride completes after the last one |
| POST | `/route-offers` | Driver | Publish a going-this-way route with free seats |
| DELETE | `/route-offers/:id` | Owner driver | Withdraw an offer |
| POST | `/rides/:id/invites` | Assigned driver | Invite a waiting rider going the same way (core feature) |

### Rider: Numman (`src/modules/trips`, `sharing`, `pricing`, `safety`, `notify`)

| Method | Path | Access | What it does |
|---|---|---|---|
| GET | `/rides/quote` | Rider | Fare for a trip before booking; nothing is stored |
| POST | `/rides` | Rider | Book a solo or shared ride with a locked fare |
| GET | `/rides/my` | Rider or driver | Own rides |
| GET | `/rides` | Support+ | All rides; filter by status and date |
| GET | `/rides/:id` | Passenger, driver or Support+ | One ride |
| POST | `/rides/:id/cancel` | Passenger or driver | Cancel own seat or the ride |
| GET | `/route-offers/nearby` | Rider | Offers that fit the rider's trip |
| POST | `/join-requests` | Rider | Ask to join a shared ride or route offer |
| GET | `/join-requests/my` | Rider or driver | Requests sent or received |
| POST | `/join-requests/:id/accept` | Other party | Accept; runs the seat transaction |
| POST | `/join-requests/:id/decline` | Other party | Decline |
| POST | `/ratings` | Passenger or driver | Rate the driver or a co-rider |
| POST | `/rides/:id/sos` | Passenger or driver | Alert support by email |
| POST | `/sos` | Any user | General SOS (extra, not in §26) |

### Support: Anyka (`src/modules/trust`, `src/modules/audit`)

| Method | Path | Access | What it does |
|---|---|---|---|
| POST | `/cases` | Any user | Report an overcharge, a safety issue or a co-rider |
| GET | `/cases` | Support+ | Case queue; filter by status |
| GET | `/cases/:id` | Reporter or Support+ | One case |
| PATCH | `/cases/:id` | Support+ | Assign, add notes, resolve |
| DELETE | `/cases/:id` | Reporter or Support+ | Withdraw a case |
| POST | `/strikes` | Support+ | Issue a strike |
| GET | `/strikes` | Support+ | List strikes |
| GET | `/strikes/:id` | Struck user or Support+ | One strike |
| PATCH | `/strikes/:id` | Support+ | Edit the reason or expiry |
| DELETE | `/strikes/:id` | Support+ | Revoke a strike |
| POST | `/strikes/:id/appeals` | Struck user | Appeal a strike |
| PATCH | `/appeals/:id` | Support+ | Decide an appeal; 403 for the officer who issued the strike |
| GET | `/audit-logs` | Support+ | Filter by user, entity and date |
| GET | `/audit-logs/:id` | Support+ | One entry |

Support+ means Support Officer or Admin. The admin routes enforce their access with `@Roles()`. The other modules check access inside their services.

## Project structure

```text
bhorsha/
├── src/
│   ├── main.ts                  starts the API and Swagger
│   ├── app.setup.ts             /api/v1 prefix, ValidationPipe, interceptors (shared with the e2e tests)
│   ├── app.module.ts            config, TypeORM (synchronize off), every module, the global filter
│   ├── common/
│   │   ├── decorators/          @Public(), @Roles(), @CurrentUser() (Siam); @CurrentUserId(), @ApiDriverDomain() (shared)
│   │   ├── dto/                 PaginationQueryDto (Roshni); Page<T>, @ApiPagination() (Siam); LIMIT_QUERY (Anyka)
│   │   ├── filters/             global exception filter and the PostgreSQL error map (Siam)
│   │   ├── guards/              JwtAuthGuard, RolesGuard (Siam); support-auth.ts (Anyka)
│   │   ├── interceptors/        timing and the response envelope (Roshni)
│   │   ├── input.ts             body checks for the support endpoints (Anyka)
│   │   ├── money.ts             Tk <-> paisa
│   │   └── transaction.ts       runInTransaction(); Tx lets two modules write in one transaction (the seat transaction)
│   ├── config/                  env validation (Numman)
│   └── modules/                 the modules of the architecture (root README section 8)
│       ├── identity/            users: auth, users, driver verification (Siam); User entity (Roshni)
│       ├── fleet/               driver_profiles, vehicles: own profile, status, location, vehicles (Roshni)
│       ├── pricing/             fare_rules: fare rules (Siam); the fare quote, PricingService (Numman)
│       ├── trips/               rides, ride_passengers, ratings: booking, cancel, ratings (Numman);
│       │                        open requests, accept, arrive, pickup, drop-off (Roshni)
│       ├── sharing/             route_offers, join_requests: nearby, join requests, the seat transaction
│       │                        (Numman); route offers, invites (Roshni)
│       ├── safety/              no table yet: SOS, emailed to the safety inbox (Numman)
│       ├── trust/               support_cases, strikes, appeals (Anyka)
│       ├── audit/               audit_logs (Anyka)
│       └── notify/              no table: email through SMTP (Numman)
├── test/                        end-to-end tests (Vitest + Supertest)
├── doc/                         databaseSQL.md, draw.io diagrams, setup photos
├── docker-compose.yml           PostgreSQL 16 (siam001/bhorsha-db:2.0.0) and Mailpit
└── .env.example                 copy to .env
```

Every module lives in `src/modules/` (the architecture's layout, §9) and follows its boundary rules (root README §8):

- A module's tables are written only by that module (doc/databaseSQL.md section 1 lists who owns what).
- To use another module, a module imports it and calls a service it exports. `trips` and `sharing` use `fleet`'s `DriversService` and `VehiclesService` and `pricing`'s `PricingService`. `sharing` and `safety` use `trips`'s `RidesService`. `safety` sends its email through `notify`.
- The seat transaction is one transaction across two modules. `sharing` runs it and writes `route_offers` and `join_requests`. `trips` writes `rides` and `ride_passengers` through `RidesService`, which receives the same `Tx` (`common/transaction.ts`).

Two things about route order matter:

- In `TripsModule`, `DriverRidesController` must stay before `RidesController`. Otherwise `GET /rides/:id` would catch `GET /rides/open`.
- The module order in `app.module.ts` is the order Swagger lists its groups (Driver Domain, then the admin groups, then Support).

## Adding an endpoint

1. **DTO.** One class per body or query, with class-validator rules and `@ApiProperty()` on every field (the Swagger CLI plugin is off, so Swagger only shows decorated fields). List queries extend `PaginationQueryDto`.
2. **Access.** Add `@Roles(Role.ADMIN)` (or other roles) if only some roles may call it. Add `@Public()` only for routes anyone may call without logging in. Read the caller with `@CurrentUser()` (the whole user) or `@CurrentUserId()` (the id). Never read `x-user-id` yourself.
3. **Errors.** Throw Nest exceptions (`NotFoundException`, `ConflictException`, …). Don't catch unique or check violations just to rethrow them: the global filter already turns them into 409 with the right message. Add new constraint names to `database-error.map.ts`.
4. **Responses.** Return plain data; the interceptor wraps it in the envelope. For lists, return `{ data, meta: { page, limit, total } }` and add `@ApiPagination()`. Never return `passwordHash` or a PIN; build the response from the fields you mean to send.
5. **Transactions.** Use a `QueryRunner` or `dataSource.transaction()`, and take locks in the order of [databaseSQL.md §9](doc/databaseSQL.md#9-transactions-the-api-must-run).
6. **Wire it.** Register the entity with `TypeOrmModule.forFeature()` in your module, and the module in `app.module.ts`. Entity columns must match the real table in databaseSQL.md, because `synchronize` is off.
7. **Test.** Put a `*.spec.ts` next to the service, add an `it` for the endpoint to `test/all-endpoints.e2e-spec.ts`, and run `pnpm test`, `pnpm test:endpoints`, `pnpm lint` and `pnpm build` before you push.

## Scripts and tests

| Command | Does |
|---|---|
| `pnpm start:dev` | Run the API and restart on changes |
| `pnpm start:debug` | Same, with the Node debugger |
| `pnpm build`, then `pnpm start:prod` | Compile to `dist/` and run it |
| `pnpm lint` | oxlint (type-aware) on `src/` and `test/` |
| `pnpm format` | Prettier on `src/` and `test/` |
| `pnpm test` | Unit tests (`src/**/*.spec.ts`, Vitest); no database needed |
| `pnpm test:cov` | Unit tests with coverage |
| `pnpm test:e2e` | End-to-end tests (`test/*.e2e-spec.ts`); need the database running |
| `pnpm test:endpoints` | Only `test/all-endpoints.e2e-spec.ts`: every one of the 55 endpoints, end to end. Needs the database and Mailpit |
| `pnpm test:concurrency` | Only the load test: 50 parallel requests for the last seat |

The unit tests cover the guards (including the `x-user-id` fallback), the error filter and its PostgreSQL map, register and login, user management, driver verification and fare rules. `test/all-endpoints.e2e-spec.ts` logs in with real tokens and creates its own accounts; only the seed admin must exist. The concurrency test sends `x-user-id`, so run it with `ALLOW_X_USER_ID=true` in `.env`. The end-to-end tests add rows to the database on every run; [doc/API-TESTING.md](doc/API-TESTING.md) shows how to run them on a throwaway database.

## Troubleshooting

| You see | Fix |
|---|---|
| `[EnvValidationError] … DB_USER is required` | Your `.env` is older than `.env.example`. Copy it again, or add the missing lines |
| `Configuration key "JWT_ACCESS_SECRET" does not exist`, or `JwtStrategy requires a secret or key` | Set `JWT_ACCESS_SECRET` in `.env` to a non-empty value (step 3) |
| `EADDRINUSE` or another app answers on port 3000 | Something else uses the port. Set `PORT=3100` in `.env`, or stop the other app (`lsof -i :3000` shows it) |
| `ECONNREFUSED 127.0.0.1:5433` | The database isn't running. `docker compose up -d`, then wait for `(healthy)` |
| Errors about missing columns after a new `DB_IMAGE` | The old data volume is still there: `docker compose down -v`, then `docker compose up -d` |
| 401 `Missing or invalid access token` in Swagger | Click **Authorize** and paste a fresh token. Tokens expire after 15 minutes and don't survive a change of `JWT_ACCESS_SECRET` |
| 401 when sending `x-user-id` | Set `ALLOW_X_USER_ID=true` in `.env` and restart, and don't send an `Authorization` header with it |
| 500 with `requestId` | Look for that `requestId` in the API's terminal output; the stack trace is there |

## Status and known issues

Checked against a fresh `siam001/bhorsha-db:2.0.0` database on 20 November 2026: all 55 endpoints work. `pnpm test:endpoints` passes (56 tests), as do the unit tests and the 50-rider seat race.

| Area | Status |
|---|---|
| Admin (11 endpoints) | Working |
| Driver (16) | Working. Invites quote the same shared fare as a rider's own request (`fare_rules.share_discount_bps`) |
| Rider (14) | Working (rewritten for DB v2 on 19 November); an SOS is emailed through Mailpit |
| Support (14) | Working. Swagger now shows their request bodies and filters |

`test/rider-lifecycle.e2e-spec.ts` was written for the v1 API (a ride without coordinates, responses without the envelope, user 1 as a rider), so its 14 tests fail even though the endpoints work. `test/all-endpoints.e2e-spec.ts` covers the same endpoints for the current API.

Not built yet:

- **Siam:** TypeORM migrations and `src/database/data-source.ts`.
- **Anyka:** the request-ID and logging middleware, and the `AuditInterceptor` that logs every POST, PUT, PATCH and DELETE. Until the middleware exists, the error filter makes up a `requestId` for each error.

## Team workflow

- Each member works on their own branch: `SiamHossain`, `SumaiyaAkterRoshni`, `Md_Numman`, `feature/anyka-support`.
- Before you start, bring your branch up to date with `main` (`git merge main`), so conflicts stay small.
- Merge into `main` through a pull request that another member approved (§21).
- Don't revert a merged pull request and then keep building on top of it: a later merge then silently deletes the files the revert removed.
- Never commit `.env` or a real secret. `.env.example` holds only shared local values.
