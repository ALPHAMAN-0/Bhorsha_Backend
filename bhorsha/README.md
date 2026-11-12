# Bhorsha API

The NestJS backend of Bhorsha, the fair ride-hailing and ride-sharing platform for Dhaka. This folder is the CSC4161 course release of Architecture v3.1: a backend-only API, shown through Swagger UI and Postman and built around driver-to-rider requests.

The architecture, the 54 planned endpoints and who builds what are in the [main README](../README.md), especially [§26 CSC4161 Course Release](../README.md#26-csc4161-course-release).

## Run it

Needs Node.js 20.19+, 22.13+ or 24.11+, pnpm and Docker.

```bash
pnpm install
cp env.example .env        # Windows: copy env.example .env
docker compose up -d       # PostgreSQL 16 with the 13 tables and demo data
pnpm start:dev             # http://localhost:3000
```

Wait until `docker compose ps` shows `bhorsha-db` as `(healthy)` before you start the API. Demo logins and demo data are in [main README §20](../README.md#20-getting-started). The database reference is [doc/databaseSQL.md](doc/databaseSQL.md).

## Folder structure

`src/` follows the architecture document (§9), and the module folders follow its modules (§8).

```text
src/
├── main.ts              bootstrap: ValidationPipe, the /api/v1 prefix and Swagger go here
├── app.module.ts        ConfigModule + TypeORM (synchronize off)
├── common/
│   ├── decorators/      @Public(), @Roles(), @CurrentUser()          Siam
│   ├── filters/         global exception filter                      Siam
│   ├── guards/          JwtAuthGuard, RolesGuard                     Siam
│   ├── interceptors/    timing and envelope (Roshni), audit (Anyka)
│   └── middleware/      request logging and the request ID           Anyka
├── config/              env loading and validation                   Numman
├── database/            data-source.ts (TypeORM CLI), migrations/    Siam
└── modules/
    ├── identity/        auth and users                               Siam
    ├── fleet/           driver profiles and vehicles                 Roshni, Siam
    ├── pricing/         fare rules and the fare quote                Siam, Numman
    ├── trips/           rides, passengers, ratings, SOS              Numman, Roshni
    ├── sharing/         route offers, invites, join requests         Roshni, Numman
    ├── trust/           cases, strikes, appeals                      Anyka
    ├── notify/          mailer (SOS email)                           Numman
    └── audit/           audit-log reads                              Anyka
```

Each module keeps its own entities, DTOs, controllers and services, for example `modules/fleet/entities/vehicle.entity.ts`. Folders without code yet hold an empty `.gitkeep`. The table of who builds which part is in [main README §9](../README.md#in-this-repo).

## Scripts

| Command | Does |
|---|---|
| `pnpm start:dev` | Run the API and restart on changes |
| `pnpm build`, then `pnpm start:prod` | Compile to `dist/` and run it |
| `pnpm lint` | oxlint (type-aware) on `src/` and `test/` |
| `pnpm format` | Prettier on `src/` and `test/` |
| `pnpm test` | Unit tests (`*.spec.ts`, Vitest) |
| `pnpm test:e2e` | End-to-end tests (`test/*.e2e-spec.ts`, Supertest) |
| `pnpm test:cov` | Unit tests with coverage |

## Rules every endpoint follows

From §8 and §26 of the architecture:

- Routes live under `/api/v1`, and Swagger is at `/api/docs`.
- Every body, query and route parameter is a DTO. The global ValidationPipe uses whitelist, forbidNonWhitelisted and transform, and a 400 lists each failing field.
- Success: `{ success, message, data, meta }`. Error: `{ success: false, error: { code, message, details }, meta: { requestId } }`.
- PostgreSQL errors 23505, 23503 and 23514 become 409. Anything else is a 500 with a generic message and no stack trace.
- Protected routes check the JWT and the role: no token gets 401, and the wrong role gets 403.
- `synchronize` stays off, and every table change comes with a migration.
- Money is integer paisa, and `password_hash` never appears in a response.
