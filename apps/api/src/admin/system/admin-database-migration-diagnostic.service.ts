/**
 * TEMPORARY: admin-only production database/migration diagnostic.
 * Remove this service, its controller, and the admin/system route after the
 * production migration audit. Read-only: never INSERT, UPDATE, DELETE, or migrate.
 */
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export const KNOWN_PENDING_MIGRATION_NAMES = [
  '20261103000000_hunt_vocation_multiple_level_ranges',
  '20261103120000_hunt_update_request_vocation_range',
  '20261103143000_billing_checkout_attempt',
] as const;

export const DIAGNOSTIC_TEMPORARY_NOTE =
  'Temporary admin-only read diagnostic. Remove after the production migration audit. This endpoint never runs migrations or writes data.';

export type DatabaseMigrationDiagnosticView = {
  temporary: true;
  note: string;
  appEnv: string | null;
  nodeEnv: string | null;
  database: {
    host: string | null;
    port: number | null;
    name: string | null;
  };
  appliedMigrations: AppliedMigrationView[];
  currentSchemaVersion: string | null;
  schema: {
    billingCheckoutAttemptTable: boolean | null;
    billingCheckoutAttemptOneActiveIndex: boolean | null;
    huntUpdateRequestRangeLevelMin: boolean | null;
    huntUpdateRequestRangeLevelMax: boolean | null;
    huntVocationHuntIdVocationUniqueIndex: boolean | null;
    huntVocationHuntIdVocationNonUniqueIndex: boolean | null;
  };
  counts: {
    users: number | null;
    orders: number | null;
    payments: number | null;
    licenses: number | null;
  };
  comparison: {
    knownPending: string[];
    knownPendingStillMissing: string[];
    knownPendingAlreadyApplied: string[];
    filesystemMigrations: string[] | null;
    filesystemPending: string[] | null;
  };
  failedSteps: string[];
};

export type AppliedMigrationView = {
  name: string;
  status: 'applied' | 'rolled_back' | 'started';
  finishedAt: string | null;
  rolledBackAt: string | null;
};

type PrismaMigrationRow = {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
};

@Injectable()
export class AdminDatabaseMigrationDiagnosticService {
  constructor(private readonly prisma: PrismaService) {}

  async run(
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<DatabaseMigrationDiagnosticView> {
    const failedSteps: string[] = [];
    const database = describeDatabaseEndpoint(env.DATABASE_URL);
    const appliedResult = await this.safeRead(
      'prisma_migrations',
      failedSteps,
      () => this.readAppliedMigrations(),
    );
    const appliedMigrations = appliedResult ?? [];
    const appliedNames = new Set(
      appliedMigrations
        .filter((row) => row.status === 'applied')
        .map((row) => row.name),
    );
    const currentSchemaVersion =
      appliedMigrations.find((row) => row.status === 'applied')?.name ?? null;

    const billingCheckoutAttemptTable = await this.safeExists(
      'billing_checkout_attempt_table',
      failedSteps,
      'BillingCheckoutAttempt',
    );
    const billingCheckoutAttemptOneActiveIndex = await this.safeIndexExists(
      'billing_checkout_attempt_index',
      failedSteps,
      'BillingCheckoutAttempt_one_active_per_user_key',
    );
    const huntColumns = await this.safeColumns(
      'hunt_update_request_columns',
      failedSteps,
      'HuntUpdateRequest',
      ['rangeLevelMin', 'rangeLevelMax'],
    );
    const huntVocationHuntIdVocationUniqueIndex = await this.safeIndexExists(
      'hunt_vocation_unique_index',
      failedSteps,
      'HuntVocation_huntId_vocation_key',
    );
    const huntVocationHuntIdVocationNonUniqueIndex = await this.safeIndexExists(
      'hunt_vocation_nonunique_index',
      failedSteps,
      'HuntVocation_huntId_vocation_idx',
    );

    const users = await this.safeCount('counts.users', failedSteps, () =>
      this.prisma.user.count(),
    );
    const orders = await this.safeCount('counts.orders', failedSteps, () =>
      this.prisma.billingOrder.count(),
    );
    const payments = await this.safeCount('counts.payments', failedSteps, () =>
      this.prisma.billingPayment.count(),
    );
    const licenses = await this.safeCount('counts.licenses', failedSteps, () =>
      this.prisma.billingLicense.count(),
    );

    const filesystemMigrations = listFilesystemMigrationNames();
    if (filesystemMigrations === null) {
      failedSteps.push('filesystem_migrations');
    }

    const knownPending = [...KNOWN_PENDING_MIGRATION_NAMES];
    const knownPendingAlreadyApplied = knownPending.filter((name) =>
      appliedNames.has(name),
    );
    const knownPendingStillMissing = knownPending.filter(
      (name) => !appliedNames.has(name),
    );
    const filesystemPending = filesystemMigrations
      ? filesystemMigrations.filter((name) => !appliedNames.has(name))
      : null;

    return {
      temporary: true,
      note: DIAGNOSTIC_TEMPORARY_NOTE,
      appEnv: env.APP_ENV?.trim() || null,
      nodeEnv: env.NODE_ENV?.trim() || null,
      database,
      appliedMigrations,
      currentSchemaVersion,
      schema: {
        billingCheckoutAttemptTable,
        billingCheckoutAttemptOneActiveIndex,
        huntUpdateRequestRangeLevelMin: huntColumns.rangeLevelMin,
        huntUpdateRequestRangeLevelMax: huntColumns.rangeLevelMax,
        huntVocationHuntIdVocationUniqueIndex,
        huntVocationHuntIdVocationNonUniqueIndex,
      },
      counts: { users, orders, payments, licenses },
      comparison: {
        knownPending,
        knownPendingStillMissing,
        knownPendingAlreadyApplied,
        filesystemMigrations,
        filesystemPending,
      },
      failedSteps,
    };
  }

  private async readAppliedMigrations(): Promise<AppliedMigrationView[]> {
    const rows = await this.prisma.$queryRaw<PrismaMigrationRow[]>`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      ORDER BY finished_at DESC NULLS LAST, started_at DESC
    `;
    return rows.map((row) => ({
      name: row.migration_name,
      status: migrationStatus(row),
      finishedAt: toIso(row.finished_at),
      rolledBackAt: toIso(row.rolled_back_at),
    }));
  }

  private async tableExists(tableName: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ${tableName}
      ) AS exists
    `;
    return Boolean(rows[0]?.exists);
  }

  private async indexExists(indexName: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = ${indexName}
      ) AS exists
    `;
    return Boolean(rows[0]?.exists);
  }

  private async columnExists(
    tableName: string,
    columnName: string,
  ): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ${tableName}
          AND column_name = ${columnName}
      ) AS exists
    `;
    return Boolean(rows[0]?.exists);
  }

  private async safeExists(
    step: string,
    failedSteps: string[],
    tableName: string,
  ): Promise<boolean | null> {
    return this.safeRead(step, failedSteps, () => this.tableExists(tableName));
  }

  private async safeIndexExists(
    step: string,
    failedSteps: string[],
    indexName: string,
  ): Promise<boolean | null> {
    return this.safeRead(step, failedSteps, () => this.indexExists(indexName));
  }

  private async safeColumns(
    step: string,
    failedSteps: string[],
    tableName: string,
    columnNames: Array<'rangeLevelMin' | 'rangeLevelMax'>,
  ): Promise<{
    rangeLevelMin: boolean | null;
    rangeLevelMax: boolean | null;
  }> {
    try {
      const [rangeLevelMin, rangeLevelMax] = await Promise.all(
        columnNames.map((columnName) =>
          this.columnExists(tableName, columnName),
        ),
      );
      return { rangeLevelMin, rangeLevelMax };
    } catch {
      failedSteps.push(step);
      return { rangeLevelMin: null, rangeLevelMax: null };
    }
  }

  private async safeCount(
    step: string,
    failedSteps: string[],
    query: () => Promise<number>,
  ): Promise<number | null> {
    return this.safeRead(step, failedSteps, query);
  }

  private async safeRead<T>(
    step: string,
    failedSteps: string[],
    query: () => Promise<T>,
  ): Promise<T | null> {
    try {
      return await query();
    } catch {
      failedSteps.push(step);
      return null;
    }
  }
}

export function describeDatabaseEndpoint(
  connectionString: string | undefined,
): {
  host: string | null;
  port: number | null;
  name: string | null;
} {
  const empty = { host: null, port: null, name: null };
  if (!connectionString?.trim()) {
    return empty;
  }
  try {
    const parsed = new URL(connectionString);
    const name = decodeURIComponent(
      parsed.pathname.replace(/^\//, '').split('/')[0] ?? '',
    ).trim();
    const port = parsed.port
      ? Number(parsed.port)
      : defaultPort(parsed.protocol);
    return {
      host: parsed.hostname || null,
      port: Number.isFinite(port) ? port : null,
      name: name || null,
    };
  } catch {
    return empty;
  }
}

export function listFilesystemMigrationNames(
  migrationsDir = resolveMigrationsDir(),
): string[] | null {
  try {
    if (!migrationsDir || !existsSync(migrationsDir)) {
      return null;
    }
    return readdirSync(migrationsDir)
      .filter((name) => /^\d{14}_/.test(name))
      .sort();
  } catch {
    return null;
  }
}

function resolveMigrationsDir() {
  const fromCwd = join(process.cwd(), 'prisma', 'migrations');
  if (existsSync(fromCwd)) {
    return fromCwd;
  }
  const fromSource = join(__dirname, '..', '..', '..', 'prisma', 'migrations');
  return existsSync(fromSource) ? fromSource : fromCwd;
}

function migrationStatus(
  row: PrismaMigrationRow,
): AppliedMigrationView['status'] {
  if (row.rolled_back_at) {
    return 'rolled_back';
  }
  if (row.finished_at) {
    return 'applied';
  }
  return 'started';
}

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function defaultPort(protocol: string) {
  return protocol === 'postgres:' || protocol === 'postgresql:' ? 5432 : null;
}
