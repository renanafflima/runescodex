/**
 * TEMPORARY: dedicated Postgres session for migration recovery locking + DDL.
 * Advisory locks are session-scoped; Prisma pool must not be used for locks.
 */
import { Client } from 'pg';
import { assertDatabaseEnvironment } from '../../common/database-target';
import { MIGRATION_RECOVERY_ADVISORY_LOCK_KEY } from './admin-migration-recovery.constants';

export type MigrationRecoveryPgSession = {
  client: Client;
  release: () => Promise<void>;
};

export async function openMigrationRecoverySession(
  env: NodeJS.ProcessEnv = process.env,
): Promise<MigrationRecoveryPgSession> {
  assertDatabaseEnvironment(env);
  const connectionString = env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = new Client({ connectionString });
  await client.connect();

  const locked = await client.query<{ locked: boolean }>(
    'SELECT pg_try_advisory_lock($1) AS locked',
    [MIGRATION_RECOVERY_ADVISORY_LOCK_KEY],
  );
  if (!locked.rows[0]?.locked) {
    await client.end();
    throw new Error('Migration recovery advisory lock is not available.');
  }

  return {
    client,
    release: async () => {
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [
          MIGRATION_RECOVERY_ADVISORY_LOCK_KEY,
        ]);
      } finally {
        await client.end();
      }
    },
  };
}

export async function pgIndexExists(
  client: Client,
  indexName: string,
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = $1
    ) AS exists`,
    [indexName],
  );
  return Boolean(result.rows[0]?.exists);
}

export async function pgTableExists(
  client: Client,
  tableName: string,
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS exists`,
    [tableName],
  );
  return Boolean(result.rows[0]?.exists);
}

export async function pgEnumExists(
  client: Client,
  typeName: string,
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1
      FROM pg_type t
      INNER JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = $1
    ) AS exists`,
    [typeName],
  );
  return Boolean(result.rows[0]?.exists);
}

export async function pgColumnExists(
  client: Client,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
    ) AS exists`,
    [tableName, columnName],
  );
  return Boolean(result.rows[0]?.exists);
}

export async function pgAppliedMigrations(client: Client): Promise<Set<string>> {
  const result = await client.query<{ migration_name: string }>(`
    SELECT migration_name
    FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
  `);
  return new Set(result.rows.map((row) => row.migration_name));
}

export async function pgRunInTransaction(
  client: Client,
  statements: string[],
): Promise<void> {
  await client.query('BEGIN');
  try {
    for (const statement of statements) {
      await client.query(statement);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
