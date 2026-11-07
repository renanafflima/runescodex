import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('node:child_process', () => ({
  execFile: jest.fn(),
}));

jest.mock('node:util', () => ({
  promisify: () =>
    jest.fn().mockResolvedValue({ stdout: '', stderr: '' }),
}));

jest.mock('./admin-migration-recovery.pg-session', () => ({
  openMigrationRecoverySession: jest.fn().mockResolvedValue({
    client: {},
    release: jest.fn(),
  }),
  pgAppliedMigrations: jest.fn().mockResolvedValue(
    new Set(['20261013040000_add_hunt_creature_kill_per_hour']),
  ),
  pgIndexExists: jest.fn().mockResolvedValue(false),
  pgTableExists: jest.fn().mockResolvedValue(false),
  pgEnumExists: jest.fn().mockResolvedValue(false),
  pgColumnExists: jest.fn().mockResolvedValue(false),
  pgRunInTransaction: jest.fn().mockResolvedValue(undefined),
}));

import {
  AdminMigrationRecoveryService,
  splitMigrationStatements,
} from './admin-migration-recovery.service';

describe('splitMigrationStatements', () => {
  it('splits migration sql into executable statements', () => {
    const parts = splitMigrationStatements(
      'CREATE TABLE "A" ("id" TEXT);\n\n-- comment\nALTER TABLE "A" ADD COLUMN "x" INT;',
    );
    expect(parts).toEqual([
      'CREATE TABLE "A" ("id" TEXT)',
      'ALTER TABLE "A" ADD COLUMN "x" INT',
    ]);
  });
});

describe('AdminMigrationRecoveryService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $executeRawUnsafe: jest.fn(),
    $transaction: jest.fn((fn: (tx: typeof prisma) => Promise<void>) =>
      fn(prisma),
    ),
  };

  let service: AdminMigrationRecoveryService;
  let previousEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminMigrationRecoveryService(prisma as never);
    previousEnv = { ...process.env };
    process.env.APP_ENV = 'production';
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL =
      'postgresql://user:secret@ep-prod.example.neon.tech/runescodex?sslmode=require';
    process.env.PRODUCTION_DATABASE_HOST = 'ep-prod.example.neon.tech';
  });

  afterEach(() => {
    process.env = previousEnv;
  });

  function mockApplied(names: string[]) {
    prisma.$queryRaw.mockImplementation(
      (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = strings.join(' ');
        if (sql.includes('pg_try_advisory_lock')) {
          return Promise.resolve([{ locked: true }]);
        }
        if (sql.includes('pg_advisory_unlock')) {
          return Promise.resolve([]);
        }
        if (sql.includes('_prisma_migrations')) {
          if (values.length === 0) {
            return Promise.resolve(
              names.map((migration_name) => ({ migration_name })),
            );
          }
        }
        if (sql.includes('pg_indexes') && values[0] === 'HuntVocation_huntId_vocation_key') {
          return Promise.resolve([{ exists: false }]);
        }
        if (sql.includes('pg_indexes') && values[0] === 'HuntVocation_huntId_vocation_idx') {
          return Promise.resolve([{ exists: false }]);
        }
        if (sql.includes('information_schema.columns')) {
          return Promise.resolve([{ exists: false }]);
        }
        if (sql.includes('information_schema.tables')) {
          return Promise.resolve([{ exists: false }]);
        }
        if (sql.includes('pg_type')) {
          return Promise.resolve([{ exists: false }]);
        }
        return Promise.resolve([{ exists: false }]);
      },
    );
  }

  it('refuses diagnostic outside production', async () => {
    process.env.APP_ENV = 'development';
    await expect(service.diagnostic()).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns diagnostic with steps in production', async () => {
    mockApplied(['20261013040000_add_hunt_creature_kill_per_hour']);
    const view = await service.diagnostic();
    expect(view.temporary).toBe(true);
    expect(view.steps).toHaveLength(7);
    expect(view.database.host).toBe('ep-prod.example.neon.tech');
    expect(JSON.stringify(view)).not.toMatch(/secret/);
  });

  it('rejects execute when the requested step is not next', async () => {
    mockApplied(['20261013040000_add_hunt_creature_kill_per_hour']);
    await expect(
      service.executeStep('20261103120000_hunt_update_request_vocation_range'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects concurrent execute calls', async () => {
    mockApplied([]);
    (service as unknown as { inMemoryLock: boolean }).inMemoryLock = true;
    await expect(
      service.executeStep('20261103000000_hunt_vocation_multiple_level_ranges'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects execute outside production', async () => {
    process.env.APP_ENV = 'staging';
    await expect(
      service.executeStep('20261103000000_hunt_vocation_multiple_level_ranges'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
