/**
 * TEMPORARY: run all allowlisted production migration recovery steps in order.
 * Requires APP_ENV=production, DATABASE_URL pointing at Neon production,
 * and PRODUCTION_DATABASE_HOST matching the URL host.
 *
 * Usage (authorized environment only — never local runescodex_dev):
 *   npm run migrations:regularize-production
 */
import 'dotenv/config';
import { databaseHost, resolveAppEnv } from '../src/common/database-target';
import { MIGRATION_RECOVERY_ALLOWLIST } from '../src/admin/system/admin-migration-recovery.constants';
import { AdminMigrationRecoveryService } from '../src/admin/system/admin-migration-recovery.service';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function assertProductionTarget() {
  const appEnv = resolveAppEnv(process.env);
  if (appEnv !== 'production') {
    throw new Error('Refusing to run: APP_ENV must be production.');
  }
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('Refusing to run: DATABASE_URL is not set.');
  }
  const host = databaseHost(url);
  const local = new Set(['localhost', '127.0.0.1', '::1']);
  if (local.has(host)) {
    throw new Error('Refusing to run: DATABASE_URL host is local.');
  }
  const expected = process.env.PRODUCTION_DATABASE_HOST?.trim();
  if (expected && host !== expected) {
    throw new Error('Refusing to run: DATABASE_URL host does not match PRODUCTION_DATABASE_HOST.');
  }
  console.log(
    JSON.stringify({
      target: 'neon-production',
      appEnv,
      host,
      databaseConfigured: true,
    }),
  );
}

async function migrateStatus() {
  await execFileAsync('npx', ['prisma', 'migrate', 'status'], {
    cwd: process.cwd(),
    env: process.env,
    timeout: 120_000,
    maxBuffer: 2 * 1024 * 1024,
  });
}

async function main() {
  assertProductionTarget();
  const service = new AdminMigrationRecoveryService({} as never);
  const results: Array<{ step: string; ok: boolean; nextStep: string | null }> =
    [];

  for (const step of MIGRATION_RECOVERY_ALLOWLIST) {
    const view = await service.executeStep(step);
    results.push({ step, ok: view.ok, nextStep: view.nextStep });
    console.log(JSON.stringify({ event: 'step-complete', step, ok: view.ok }));
    if (!view.ok) {
      process.exitCode = 1;
      return;
    }
  }

  await migrateStatus();
  console.log(JSON.stringify({ event: 'migrate-status', ok: true, results }));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Regularization failed.';
  console.error(JSON.stringify({ event: 'fatal', message }));
  process.exitCode = 1;
});
