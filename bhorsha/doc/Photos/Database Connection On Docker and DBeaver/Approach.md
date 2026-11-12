# Database Connection: Docker + DBeaver

## Approach

The Bhorsha database is PostgreSQL 16, packaged as a Docker image on Docker Hub (`siam001/bhorsha-db`).
The image already contains every table and the demo (seed) data, so nobody has to install
PostgreSQL or run SQL files by hand. Everyone runs the same image version and uses the same
login, so the database looks the same on every machine.

The flow is:

1. Docker pulls the image and starts the `bhorsha-db` container.
2. DBeaver connects to it to browse tables and run queries.
3. The NestJS app connects to it through TypeORM, reading the same values from `.env`.

```
 Docker Hub                     Your machine
┌──────────────────────┐       ┌──────────────────────────────────────────────┐
│ siam001/bhorsha-db   │ pull  │  container: bhorsha-db  (PostgreSQL 16)      │
│ (tables + seed data) │ ────► │  inside port 5432  ◄──  localhost:5433       │
└──────────────────────┘       │                            ▲          ▲      │
                               │                            │          │      │
                               │                         DBeaver   NestJS app │
                               └──────────────────────────────────────────────┘
```

## Connection details

| Setting  | Value        |
| -------- | ------------ |
| Host     | `localhost`  |
| Port     | `5433`       |
| Database | `bhorsha`    |
| Username | `bhorsha`    |
| Password | `bhorsha123` |

Connection URL: `postgresql://bhorsha:bhorsha123@localhost:5433/bhorsha`

> The port is **5433**, not the PostgreSQL default 5432. Docker maps `5433` on your machine to
> `5432` inside the container, so it won't clash with a PostgreSQL you may already have
> installed locally.

## Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop/), running
- [DBeaver](https://dbeaver.io/download/) (Community edition is enough)

---

## Step 1: Create the `.env` file

From the `bhorsha` folder, copy the template:

```bash
cp env.example .env          # Windows: copy env.example .env
```

`.env` holds the database image version and the login values. Docker Compose and the NestJS
app both read it. Without a `.env`, Docker Compose still works using the same defaults.

## Step 2: Pull and start the database

```bash
docker compose up -d         # older Docker installs: docker-compose up -d
```

The first run downloads the image `siam001/bhorsha-db:2.0.0` (schema v2: 13 tables), creates the
network and starts the `bhorsha-db` container.

![Database image pulled and container started](photo/Database%20Pull.png)

Check that it is ready:

```bash
docker compose ps
```

Wait until `bhorsha-db` shows **`(healthy)`**. The image checks itself with `pg_isready` every
few seconds, so this only takes a moment.

## Step 3: Check the container in Docker Desktop

Open Docker Desktop and go to **Containers**. You should see **bhorsha** with a green dot,
which means it is running.

![bhorsha container running in Docker Desktop](photo/Database%20On%20Docker.png)

## Step 4: Create a new connection in DBeaver

Open DBeaver and click the **New Database Connection** button (plug icon with a `+`) at the
top left of the Connections panel. Shortcut: `Ctrl + Shift + N` (macOS: `⌃ ⇧ N`).

![New Database Connection button in DBeaver](photo/1.png)

## Step 5: Select PostgreSQL

In **Connect to a database**, select **PostgreSQL** and click **Next**.

![Select PostgreSQL as the database](photo/2.png)

## Step 6: Fill in the connection settings

DBeaver opens the form with PostgreSQL defaults (port `5432`, database `postgres`,
user `postgres`). These are **wrong** for Bhorsha.

![Default PostgreSQL settings in DBeaver](photo/3.png)

Change them to the Bhorsha values:

| Field    | Change to    |
| -------- | ------------ |
| Host     | `localhost`  |
| Port     | `5433`       |
| Database | `bhorsha`    |
| Username | `bhorsha`    |
| Password | `bhorsha123` |

Keep **Connect by: Host** selected and tick **Save password**. The URL line updates to
`jdbc:postgresql://localhost:5433/bhorsha`.

![Bhorsha connection settings filled in](photo/4.png)

> If DBeaver asks to download the PostgreSQL driver files, click **Download**. It only does
> this the first time.

## Step 7: Test the connection

Click **Test Connection...** at the bottom left. You should see **Connected**, with the server
shown as PostgreSQL 16. Click **OK**, then **Finish**.

![Connection test successful](photo/Press%20Test%20Conntection.png)

## Step 8: Confirm the connection

The **bhorsha** connection (`localhost:5433`) now appears in the Connections panel. The green
check mark on its icon means DBeaver is connected. Expand it to browse
`bhorsha → Schemas → public → Tables`.

![bhorsha connection in the DBeaver Connections panel](photo/See%20Blue%20Mark.png)

---

## How the NestJS app connects

The app uses the same database. `src/app.module.ts` loads `.env` with `ConfigModule` and opens
the connection with `TypeOrmModule.forRootAsync`:

| `.env` key          | Used for                                   |
| ------------------- | ------------------------------------------ |
| `DB_HOST`           | Host (`localhost`)                         |
| `DB_PORT`           | Port (`5433`)                              |
| `POSTGRES_USER`     | Username                                   |
| `POSTGRES_PASSWORD` | Password                                   |
| `POSTGRES_DB`       | Database name                              |
| `DB_POOL_MAX`       | Max connections in the pool (default `10`) |
| `DB_LOGGING`        | `true` prints every SQL query to the console |

`synchronize` is set to `false`, so TypeORM never changes the tables. The Docker image is the
single source of the schema.

With the container running, start the app:

```bash
pnpm install
pnpm start:dev
```

If the app starts without a database error, it is connected.

## Useful commands

| Command                  | What it does                                                |
| ------------------------ | ----------------------------------------------------------- |
| `docker compose up -d`   | Start the database                                          |
| `docker compose ps`      | Show status; wait for `(healthy)`                           |
| `docker compose logs db` | Show the database logs                                      |
| `docker compose down`    | Stop the database. **Data is kept.**                        |
| `docker compose down -v` | Stop and **delete all data**. The next `up` loads fresh seed data. |

## Troubleshooting

| Problem                                       | Fix                                                                                                   |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Connection refused`                          | The container isn't running. Run `docker compose up -d` and wait for `(healthy)`.                    |
| `password authentication failed`              | Check username `bhorsha` and password `bhorsha123`. If you changed `.env` after the first run, the old password is still stored; run `docker compose down -v` then `up -d`. |
| `database "postgres" does not exist` / wrong data | Port is still `5432` or database is still `postgres`. Use port `5433` and database `bhorsha`.     |
| `port is already allocated` on `up`           | Something else is using port 5433. Set `DB_PORT` in `.env` to a free port and use it in DBeaver too. |
| Tables are missing                            | Expand `Schemas → public → Tables` and press `F5` to refresh.                                         |
| Old tables after a new image version          | Update `DB_IMAGE` in `.env`, then `docker compose down -v` and `docker compose up -d`.                |
