import { readFileSync } from 'fs';
import { join } from 'path';
import {
  AdminDatabaseMigrationDiagnosticService,
  describeDatabaseEndpoint,
  DIAGNOSTIC_TEMPORARY_NOTE,
  KNOWN_PENDING_MIGRATION_NAMES,
} from './admin-database-migration-diagnostic.service';

const WRITE_SQL =
  /\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE|GRANT|REVOKE)\b/i;

describe('describeDatabaseEndpoint', () => {
  it('returns host, port and database name without credentials', () => {
    const target = describeDatabaseEndpoint(
      'postgresql://runescodex:super-secret@dpg-prod-a.oregon-postgres.render.com:5432/runescodex_prod?sslmode=require',
    );
    expect(target).toEqual({
      host: 'dpg-prod-a.oregon-postgres.render.com',
      port: 5432,
      name: 'runescodex_prod',
    });
    expect(JSON.stringify(target)).not.toMatch(/super-secret|runescodex:/);
  });

  it('defaults the Postgres port when it is omitted', () => {
    expect(
      describeDatabaseEndpoint('postgresql://user:pass@db.internal/app'),
    ).toEqual({
      host: 'db.internal',
      port: 5432,
      name: 'app',
    });
  });
});

describe('AdminDatabaseMigrationDiagnosticService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $executeRawUnsafe: jest.fn(),
    $queryRawUnsafe: jest.fn(),
    user: { count: jest.fn() },
    billingOrder: { count: jest.fn() },
    billingPayment: { count: jest.fn() },
    billingLicense: { count: jest.fn() },
  };

  let service: AdminDatabaseMigrationDiagnosticService;
  let previous: {
    DATABASE_URL?: string;
    APP_ENV?: string;
    NODE_ENV?: string;
  };

  function sqlText(strings: TemplateStringsArray) {
    return Array.from(strings).join(' ');
  }

  function mockCatalog(options: {
    tables?: Record<string, boolean>;
    indexes?: Record<string, boolean>;
    columns?: Record<string, boolean>;
    migrations?: Array<{
      migration_name: string;
      finished_at: Date | null;
      rolled_back_at: Date | null;
    }>;
    missingMigrationsTable?: boolean;
  }) {
    prisma.$queryRaw.mockImplementation(
      (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = sqlText(strings);
        expect(sql).not.toMatch(WRITE_SQL);
        if (sql.includes('_prisma_migrations')) {
          if (options.missingMigrationsTable) {
            return Promise.reject(
              new Error(
                'relation "_prisma_migrations" does not exist password=super-secret',
              ),
            );
          }
          return Promise.resolve(options.migrations ?? []);
        }
        const name = sqlName(values[0]);
        if (sql.includes('information_schema.tables')) {
          return Promise.resolve([{ exists: Boolean(options.tables?.[name]) }]);
        }
        if (sql.includes('pg_indexes')) {
          return Promise.resolve([
            { exists: Boolean(options.indexes?.[name]) },
          ]);
        }
        if (sql.includes('information_schema.columns')) {
          const column = sqlName(values[1]);
          return Promise.resolve([
            { exists: Boolean(options.columns?.[column]) },
          ]);
        }
        return Promise.reject(new Error(`unexpected diagnostic SQL: ${sql}`));
      },
    );
  }

  beforeEach(() => {
    previous = {
      DATABASE_URL: process.env.DATABASE_URL,
      APP_ENV: process.env.APP_ENV,
      NODE_ENV: process.env.NODE_ENV,
    };
    process.env.DATABASE_URL =
      'postgresql://prod_user:prod-token-value@dpg-prod-a.oregon-postgres.render.com:5432/runescodex_prod';
    process.env.APP_ENV = 'production';
    process.env.NODE_ENV = 'production';
    jest.clearAllMocks();
    prisma.user.count.mockResolvedValue(12);
    prisma.billingOrder.count.mockResolvedValue(4);
    prisma.billingPayment.count.mockResolvedValue(7);
    prisma.billingLicense.count.mockResolvedValue(3);
    mockCatalog({
      migrations: [
        {
          migration_name: '20261027200000_pending_license_grants',
          finished_at: new Date('2026-10-27T20:00:00.000Z'),
          rolled_back_at: null,
        },
      ],
      tables: { BillingCheckoutAttempt: false },
      indexes: {
        BillingCheckoutAttempt_one_active_per_user_key: false,
        HuntVocation_huntId_vocation_key: true,
        HuntVocation_huntId_vocation_idx: false,
      },
      columns: { rangeLevelMin: false, rangeLevelMax: false },
    });
    service = new AdminDatabaseMigrationDiagnosticService(prisma as never);
  });

  afterEach(() => {
    restoreEnv('DATABASE_URL', previous.DATABASE_URL);
    restoreEnv('APP_ENV', previous.APP_ENV);
    restoreEnv('NODE_ENV', previous.NODE_ENV);
  });

  it('returns environment, database identity, counts and pending comparison', async () => {
    const result = await service.run();
    const serialized = JSON.stringify(result);

    expect(result.temporary).toBe(true);
    expect(result.note).toBe(DIAGNOSTIC_TEMPORARY_NOTE);
    expect(result.appEnv).toBe('production');
    expect(result.nodeEnv).toBe('production');
    expect(result.database).toEqual({
      host: 'dpg-prod-a.oregon-postgres.render.com',
      port: 5432,
      name: 'runescodex_prod',
    });
    expect(result.currentSchemaVersion).toBe(
      '20261027200000_pending_license_grants',
    );
    expect(result.appliedMigrations).toEqual([
      {
        name: '20261027200000_pending_license_grants',
        status: 'applied',
        finishedAt: '2026-10-27T20:00:00.000Z',
        rolledBackAt: null,
      },
    ]);
    expect(result.schema).toEqual({
      billingCheckoutAttemptTable: false,
      billingCheckoutAttemptOneActiveIndex: false,
      huntUpdateRequestRangeLevelMin: false,
      huntUpdateRequestRangeLevelMax: false,
      huntVocationHuntIdVocationUniqueIndex: true,
      huntVocationHuntIdVocationNonUniqueIndex: false,
    });
    expect(result.counts).toEqual({
      users: 12,
      orders: 4,
      payments: 7,
      licenses: 3,
    });
    expect(result.comparison.knownPending).toEqual([
      ...KNOWN_PENDING_MIGRATION_NAMES,
    ]);
    expect(result.comparison.knownPendingStillMissing).toEqual([
      ...KNOWN_PENDING_MIGRATION_NAMES,
    ]);
    expect(result.comparison.knownPendingAlreadyApplied).toEqual([]);
    expect(result.failedSteps).toEqual([]);
    expect(serialized).not.toMatch(
      /prod-token-value|prod_user|postgresql:\/\/|DATABASE_URL/,
    );
    expect(serialized).not.toMatch(/@|password|secret|token/i);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('treats a missing table as false without failing the whole diagnostic', async () => {
    mockCatalog({
      migrations: [],
      tables: {},
      indexes: {},
      columns: {},
    });

    const result = await service.run();

    expect(result.schema.billingCheckoutAttemptTable).toBe(false);
    expect(result.schema.huntUpdateRequestRangeLevelMin).toBe(false);
    expect(result.failedSteps).toEqual([]);
  });

  it('keeps other steps when _prisma_migrations is missing and hides SQL errors', async () => {
    mockCatalog({ missingMigrationsTable: true });

    const result = await service.run();
    const serialized = JSON.stringify(result);

    expect(result.appliedMigrations).toEqual([]);
    expect(result.currentSchemaVersion).toBeNull();
    expect(result.failedSteps).toContain('prisma_migrations');
    expect(result.counts.users).toBe(12);
    expect(serialized).not.toMatch(/does not exist|super-secret|password=/);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('does not fail the diagnostic when a count table is missing', async () => {
    prisma.billingPayment.count.mockRejectedValue(
      new Error('table BillingPayment does not exist'),
    );

    const result = await service.run();

    expect(result.counts.payments).toBeNull();
    expect(result.counts.users).toBe(12);
    expect(result.failedSteps).toEqual(['counts.payments']);
  });

  it('marks known pending migrations as applied when they appear in history', async () => {
    mockCatalog({
      migrations: [
        {
          migration_name: '20261103143000_billing_checkout_attempt',
          finished_at: new Date('2026-11-03T14:30:00.000Z'),
          rolled_back_at: null,
        },
        {
          migration_name: '20261103120000_hunt_update_request_vocation_range',
          finished_at: new Date('2026-11-03T12:00:00.000Z'),
          rolled_back_at: null,
        },
        {
          migration_name: '20261103000000_hunt_vocation_multiple_level_ranges',
          finished_at: new Date('2026-11-03T00:00:00.000Z'),
          rolled_back_at: null,
        },
      ],
      tables: { BillingCheckoutAttempt: true },
      indexes: {
        BillingCheckoutAttempt_one_active_per_user_key: true,
        HuntVocation_huntId_vocation_key: false,
        HuntVocation_huntId_vocation_idx: true,
      },
      columns: { rangeLevelMin: true, rangeLevelMax: true },
    });

    const result = await service.run();

    expect(result.comparison.knownPendingStillMissing).toEqual([]);
    expect(result.comparison.knownPendingAlreadyApplied).toEqual([
      ...KNOWN_PENDING_MIGRATION_NAMES,
    ]);
    expect(result.schema.billingCheckoutAttemptTable).toBe(true);
    expect(result.schema.billingCheckoutAttemptOneActiveIndex).toBe(true);
  });
});

describe('admin database migration diagnostic source', () => {
  it('contains only read SQL and is marked temporary', () => {
    const source = readFileSync(
      join(__dirname, 'admin-database-migration-diagnostic.service.ts'),
      'utf8',
    );
    expect(source).toContain('TEMPORARY');
    expect(source).toMatch(/\$queryRaw/);
    expect(source).not.toMatch(/\$executeRaw|\$queryRawUnsafe/);
    expect(source).not.toMatch(/\bprisma migrate\b|migrate deploy/);
  });
});

function sqlName(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
