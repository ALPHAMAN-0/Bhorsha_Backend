/**
 * Data source for the TypeORM CLI: `pnpm migration:generate` and `pnpm migration:run`.
 * The API doesn't import this file; it connects through TypeOrmModule in app.module.ts.
 *
 * TODO(payments step 1, see modules/ledger/ledger.module.ts): export a DataSource
 * built from the same DB_* variables as app.module.ts, with synchronize off and the
 * migrations in src/database/migrations, then add the two scripts to package.json.
 * The database image (2.0.0) has no ledger tables, so they arrive as migrations
 * (doc/databaseSQL.md section 1).
 */
export {};
