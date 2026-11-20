import { DataSource, QueryResult, QueryRunner } from 'typeorm';

/**
 * Runs SQL inside one transaction and always returns the rows. One module
 * passes it to another's exported service so both write in the same
 * transaction (the seat transaction, doc/databaseSQL.md sections 1 and 9).
 */
export class Tx {
  constructor(private readonly runner: QueryRunner) {}

  async rows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result: QueryResult = await this.runner.query(sql, params, true);
    return result.records as T[];
  }

  async one<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return (await this.rows<T>(sql, params))[0];
  }
}

/** Runs work in one transaction: commit when it returns, roll back when it throws. */
export async function inTransaction<T>(
  dataSource: DataSource,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    const result = await work(new Tx(runner));
    await runner.commitTransaction();
    return result;
  } catch (error) {
    await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
  }
}
