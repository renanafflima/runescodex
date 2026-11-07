/**
 * TEMPORARY: admin-only controlled migration recovery for production Neon.
 * Remove after _prisma_migrations is aligned. Never runs migrate deploy wholesale.
 */
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { loggedErrorSummary, publicErrorText } from '../../common/redact-error';
import { resolveAppEnv } from '../../common/database-target';
import {
  describeDatabaseEndpoint,
  listFilesystemMigrationNames,
} from './admin-database-migration-diagnostic.service';
import {
  MIGRATION_RECOVERY_ALLOWLIST,
  MIGRATION_RECOVERY_TEMPORARY_NOTE,
  type MigrationRecoveryStepName,
} from './admin-migration-recovery.constants';
import {
  assessRecoveryStep,
  buildDiagnosticSteps,
  type MigrationRecoveryProbe,
  type StepAssessment,
} from './admin-migration-recovery.physical';
import {
  openMigrationRecoverySession,
  pgAppliedMigrations,
  pgColumnExists,
  pgEnumExists,
  pgIndexExists,
  pgRunInTransaction,
  pgTableExists,
  type MigrationRecoveryPgSession,
} from './admin-migration-recovery.pg-session';
import type { Client } from 'pg';

const execFileAsync = promisify(execFile);

export type MigrationRecoveryLogEntry = {
  at: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  step?: MigrationRecoveryStepName;
};

export type MigrationRecoveryDiagnosticView = {
  temporary: true;
  note: string;
  appEnv: string | null;
  database: ReturnType<typeof describeDatabaseEndpoint>;
  filesystemMigrations: string[] | null;
  appliedMigrations: string[];
  steps: ReturnType<typeof buildDiagnosticSteps>;
  nextStep: MigrationRecoveryStepName | null;
  inProgress: boolean;
  logs: MigrationRecoveryLogEntry[];
};

export type MigrationRecoveryExecuteView = {
  temporary: true;
  ok: boolean;
  step: MigrationRecoveryStepName;
  action: 'ddl+resolve' | 'resolve-only' | 'ddl+resolve-partial';
  logs: MigrationRecoveryLogEntry[];
  nextStep: MigrationRecoveryStepName | null;
  error?: string;
};

@Injectable()
export class AdminMigrationRecoveryService {
  private inMemoryLock = false;
  private readonly sessionLogs: MigrationRecoveryLogEntry[] = [];

  constructor(private readonly prisma: PrismaService) {}

  async diagnostic(
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<MigrationRecoveryDiagnosticView> {
    this.assertProductionOrThrow(env, 'diagnostic');
    const applied = await this.readAppliedMigrationNames();
    const probe = this.createProbe();
    const assessments: StepAssessment[] = [];
    for (const step of MIGRATION_RECOVERY_ALLOWLIST) {
      assessments.push(await assessRecoveryStep(probe, step, applied));
    }
    const steps = buildDiagnosticSteps(assessments);
    const next =
      steps.find((item) => item.isNextExecutable)?.step ??
      (steps.every((item) => item.migrationInHistory) ? null : pickFirstBlocked(steps));

    return {
      temporary: true,
      note: MIGRATION_RECOVERY_TEMPORARY_NOTE,
      appEnv: env.APP_ENV?.trim() || null,
      database: describeDatabaseEndpoint(env.DATABASE_URL),
      filesystemMigrations: listFilesystemMigrationNames(),
      appliedMigrations: [...applied],
      steps,
      nextStep: next,
      inProgress: this.inMemoryLock,
      logs: [...this.sessionLogs],
    };
  }

  async executeStep(
    step: MigrationRecoveryStepName,
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<MigrationRecoveryExecuteView> {
    this.assertProductionOrThrow(env, 'execute');
    const logs: MigrationRecoveryLogEntry[] = [];
    const push = (level: MigrationRecoveryLogEntry['level'], message: string) => {
      logs.push({
        at: new Date().toISOString(),
        level,
        message,
        step,
      });
    };

    if (this.inMemoryLock) {
      throw new ConflictException('Migration recovery already in progress.');
    }

    this.inMemoryLock = true;
    let session: MigrationRecoveryPgSession | null = null;
    try {
      try {
        session = await openMigrationRecoverySession(env);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Migration recovery lock failed.';
        if (message.includes('advisory lock')) {
          throw new ConflictException('Database migration recovery lock is held.');
        }
        throw error;
      }
      const applied = await pgAppliedMigrations(session.client);
      if (applied.has(step)) {
        throw new ConflictException('This migration step is already applied.');
      }

      const probe = this.createProbeFromClient(session.client);
      const assessments: StepAssessment[] = [];
      for (const allow of MIGRATION_RECOVERY_ALLOWLIST) {
        assessments.push(await assessRecoveryStep(probe, allow, applied));
      }
      const next = pickNextStep(assessments);
      if (next !== step) {
        throw new BadRequestException(
          `Execute the next allowed step only: ${next ?? 'none (already complete)'}.`,
        );
      }

      const assessment = assessments.find((item) => item.step === step);
      if (!assessment) {
        throw new BadRequestException('Unknown recovery step.');
      }

      push('info', `Starting recovery for ${step}.`);

      let action: MigrationRecoveryExecuteView['action'] = 'resolve-only';

      if (assessment.readyForDdl) {
        action = 'ddl+resolve';
        await this.runDdlForStep(step, session.client, push);
        await this.assertPostDdl(session.client, step, push);
      } else if (!assessment.readyForResolveOnly) {
        const reason =
          assessment.blockedReasons.join(' ') || 'Step is not ready.';
        push('error', reason);
        throw new BadRequestException(reason);
      } else {
        action = 'resolve-only';
        push('info', 'Physical objects present; marking migration as applied only.');
      }

      await this.markMigrationApplied(step, push);
      push('info', `Completed ${step}.`);

      const appliedAfter = await pgAppliedMigrations(session.client);
      const afterAssessments: StepAssessment[] = [];
      for (const allow of MIGRATION_RECOVERY_ALLOWLIST) {
        afterAssessments.push(
          await assessRecoveryStep(
            this.createProbeFromClient(session.client),
            allow,
            appliedAfter,
          ),
        );
      }

      const nextStep = pickNextStep(afterAssessments);
      const view: MigrationRecoveryExecuteView = {
        temporary: true,
        ok: true,
        step,
        action,
        logs,
        nextStep,
      };
      this.sessionLogs.push(...logs);
      return view;
    } catch (error) {
      const summary = loggedErrorSummary(error);
      push('error', summary);
      this.sessionLogs.push(...logs);
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new ServiceUnavailableException(publicErrorText(error));
    } finally {
      this.inMemoryLock = false;
      if (session) {
        await session.release();
      }
    }
  }

  private assertProductionOrThrow(
    env: NodeJS.ProcessEnv,
    mode: 'diagnostic' | 'execute',
  ) {
    const appEnv = resolveAppEnv(env);
    if (appEnv !== 'production') {
      throw new ForbiddenException(
        `Migration recovery ${mode} is only available when APP_ENV=production.`,
      );
    }
  }

  private createProbe(): MigrationRecoveryProbe {
    return {
      migrationApplied: async (name) => {
        const applied = await this.readAppliedMigrationNames();
        return applied.has(name);
      },
      indexExists: (name) => this.indexExists(name),
      tableExists: (name) => this.tableExists(name),
      enumExists: (name) => this.enumExists(name),
      columnExists: (table, column) => this.columnExists(table, column),
    };
  }

  private createProbeFromClient(client: Client): MigrationRecoveryProbe {
    return {
      migrationApplied: async (name) => {
        const applied = await pgAppliedMigrations(client);
        return applied.has(name);
      },
      indexExists: (name) => pgIndexExists(client, name),
      tableExists: (name) => pgTableExists(client, name),
      enumExists: (name) => pgEnumExists(client, name),
      columnExists: (table, column) => pgColumnExists(client, table, column),
    };
  }

  private async readAppliedMigrationNames(): Promise<Set<string>> {
    const rows = await this.prisma.$queryRaw<
      Array<{ migration_name: string }>
    >`
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    `;
    return new Set(rows.map((row) => row.migration_name));
  }

  private async indexExists(indexName: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = ${indexName}
      ) AS exists
    `;
    return Boolean(rows[0]?.exists);
  }

  private async tableExists(tableName: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ${tableName}
      ) AS exists
    `;
    return Boolean(rows[0]?.exists);
  }

  private async enumExists(typeName: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM pg_type t
        INNER JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = ${typeName}
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
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ${tableName}
          AND column_name = ${columnName}
      ) AS exists
    `;
    return Boolean(rows[0]?.exists);
  }

  private async runDdlForStep(
    step: MigrationRecoveryStepName,
    client: Client,
    push: (level: MigrationRecoveryLogEntry['level'], message: string) => void,
  ) {
    switch (step) {
      case '20261103000000_hunt_vocation_multiple_level_ranges':
        await this.applyHuntVocationIndexMigration(client, push);
        return;
      case '20261103120000_hunt_update_request_vocation_range':
        await this.applyHuntUpdateRequestColumns(client, push);
        return;
      case '20261103143000_billing_checkout_attempt':
        await this.applyMigrationFileSql(
          client,
          '20261103143000_billing_checkout_attempt',
          push,
        );
        return;
      case '20261107143000_community_rotation_publish_idempotency':
        await this.applyMigrationFileSql(
          client,
          '20261107143000_community_rotation_publish_idempotency',
          push,
        );
        return;
      case '20261107143500_drop_community_rotation_sort_enum':
        await this.applyMigrationFileSql(
          client,
          '20261107143500_drop_community_rotation_sort_enum',
          push,
        );
        return;
      default:
        throw new BadRequestException(
          `Step ${step} does not support DDL through recovery API.`,
        );
    }
  }

  private async applyHuntVocationIndexMigration(
    client: Client,
    push: (level: MigrationRecoveryLogEntry['level'], message: string) => void,
  ) {
    const keyExists = await pgIndexExists(client, 'HuntVocation_huntId_vocation_key');
    const idxExists = await pgIndexExists(client, 'HuntVocation_huntId_vocation_idx');
    if (idxExists) {
      push('info', 'HuntVocation composite index already present; skipping DDL.');
      return;
    }
    const statements: string[] = [];
    if (keyExists) {
      push('info', 'Dropping HuntVocation_huntId_vocation_key (verified present).');
      statements.push('DROP INDEX "HuntVocation_huntId_vocation_key"');
    } else {
      push(
        'info',
        'HuntVocation_huntId_vocation_key absent; skipping DROP as required.',
      );
    }
    push('info', 'Creating HuntVocation_huntId_vocation_idx.');
    statements.push(
      'CREATE INDEX "HuntVocation_huntId_vocation_idx" ON "HuntVocation"("huntId", "vocation")',
    );
    await pgRunInTransaction(client, statements);
  }

  private async applyHuntUpdateRequestColumns(
    client: Client,
    push: (level: MigrationRecoveryLogEntry['level'], message: string) => void,
  ) {
    const min = await pgColumnExists(client, 'HuntUpdateRequest', 'rangeLevelMin');
    const max = await pgColumnExists(client, 'HuntUpdateRequest', 'rangeLevelMax');
    const statements: string[] = [];
    if (!min) {
      push('info', 'Adding HuntUpdateRequest.rangeLevelMin.');
      statements.push(
        'ALTER TABLE "HuntUpdateRequest" ADD COLUMN "rangeLevelMin" INTEGER',
      );
    }
    if (!max) {
      push('info', 'Adding HuntUpdateRequest.rangeLevelMax.');
      statements.push(
        'ALTER TABLE "HuntUpdateRequest" ADD COLUMN "rangeLevelMax" INTEGER',
      );
    }
    if (statements.length > 0) {
      await pgRunInTransaction(client, statements);
    }
  }

  private async applyMigrationFileSql(
    client: Client,
    migrationFolder: string,
    push: (level: MigrationRecoveryLogEntry['level'], message: string) => void,
  ) {
    const sqlPath = join(
      this.migrationsRoot(),
      migrationFolder,
      'migration.sql',
    );
    if (!existsSync(sqlPath)) {
      throw new ServiceUnavailableException('Migration SQL file is missing.');
    }
    const statements = splitMigrationStatements(readFileSync(sqlPath, 'utf8'));
    if (statements.length === 0) {
      throw new ServiceUnavailableException('Migration SQL file is empty.');
    }
    push('info', `Applying ${statements.length} SQL statement(s) from migration file.`);
    await pgRunInTransaction(client, statements);
  }

  private async assertPostDdl(
    client: Client,
    step: MigrationRecoveryStepName,
    push: (level: MigrationRecoveryLogEntry['level'], message: string) => void,
  ) {
    const probe = this.createProbeFromClient(client);
    const reassessed = await assessRecoveryStep(
      probe,
      step,
      await pgAppliedMigrations(client),
    );
    if (step === '20261103000000_hunt_vocation_multiple_level_ranges') {
      const idx = await probe.indexExists('HuntVocation_huntId_vocation_idx');
      if (!idx) {
        throw new BadRequestException(
          'HuntVocation index migration did not reach the expected state.',
        );
      }
      push('info', 'Post-DDL HuntVocation index state verified.');
      return;
    }
    if (step === '20261103120000_hunt_update_request_vocation_range') {
      const min = await probe.columnExists('HuntUpdateRequest', 'rangeLevelMin');
      const max = await probe.columnExists('HuntUpdateRequest', 'rangeLevelMax');
      if (!min || !max) {
        throw new BadRequestException(
          'HuntUpdateRequest range columns still missing after DDL.',
        );
      }
      push('info', 'Post-DDL HuntUpdateRequest columns verified.');
      return;
    }
    if (step === '20261103143000_billing_checkout_attempt') {
      if (!reassessed.readyForResolveOnly) {
        throw new BadRequestException(
          'BillingCheckoutAttempt migration did not reach the expected state.',
        );
      }
      push('info', 'Post-DDL BillingCheckoutAttempt verified.');
      return;
    }
    if (step === '20261107143000_community_rotation_publish_idempotency') {
      if (!reassessed.readyForResolveOnly) {
        throw new BadRequestException(
          'CommunityRotationPublishIdempotency still incomplete after DDL.',
        );
      }
      push('info', 'Post-DDL publish idempotency verified.');
      return;
    }
    if (step === '20261107143500_drop_community_rotation_sort_enum') {
      const sortEnum = await probe.enumExists('CommunityRotationSort');
      if (sortEnum) {
        throw new BadRequestException(
          'CommunityRotationSort enum still present after DDL.',
        );
      }
      push('info', 'Post-DDL CommunityRotationSort enum absence verified.');
      return;
    }
    if (!reassessed.readyForResolveOnly) {
      throw new BadRequestException(
        'DDL completed but physical validation still reports missing objects.',
      );
    }
    push('info', 'Post-DDL physical validation succeeded.');
  }

  private async markMigrationApplied(
    step: MigrationRecoveryStepName,
    push: (level: MigrationRecoveryLogEntry['level'], message: string) => void,
  ) {
    push('info', 'Recording migration in Prisma history (resolve --applied).');
    const cwd = this.migrationsRoot().replace(/[/\\]migrations$/, '');
    try {
      await execFileAsync(
        'npx',
        ['prisma', 'migrate', 'resolve', '--applied', step],
        {
          cwd,
          env: process.env,
          timeout: 120_000,
          maxBuffer: 1024 * 1024,
        },
      );
    } catch (error) {
      throw new ServiceUnavailableException(loggedErrorSummary(error));
    }
    const applied = await this.readAppliedMigrationNames();
    if (!applied.has(step)) {
      throw new ServiceUnavailableException(
        'Prisma resolve finished but migration is not visible in history.',
      );
    }
  }

  private migrationsRoot(): string {
    const fromCwd = join(process.cwd(), 'prisma', 'migrations');
    if (existsSync(fromCwd)) {
      return fromCwd;
    }
    const fromSource = join(__dirname, '..', '..', '..', 'prisma', 'migrations');
    return existsSync(fromSource) ? fromSource : fromCwd;
  }
}

export function splitMigrationStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((part) =>
      part
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter((part) => part.length > 0);
}

function pickNextStep(
  assessments: StepAssessment[],
): MigrationRecoveryStepName | null {
  for (const item of assessments) {
    if (item.migrationInHistory) {
      continue;
    }
    if (!priorApplied(item.step, assessments)) {
      return item.step;
    }
    if (item.readyForDdl || item.readyForResolveOnly) {
      return item.step;
    }
    return item.step;
  }
  return null;
}

function priorApplied(
  step: MigrationRecoveryStepName,
  assessments: StepAssessment[],
): boolean {
  const index = MIGRATION_RECOVERY_ALLOWLIST.indexOf(step);
  if (index <= 0) {
    return true;
  }
  for (let i = 0; i < index; i += 1) {
    const prior = assessments[i];
    if (!prior.migrationInHistory) {
      return false;
    }
  }
  return true;
}

function pickFirstBlocked(
  steps: ReturnType<typeof buildDiagnosticSteps>,
): MigrationRecoveryStepName | null {
  for (const item of steps) {
    if (!item.migrationInHistory) {
      return item.step;
    }
  }
  return null;
}
