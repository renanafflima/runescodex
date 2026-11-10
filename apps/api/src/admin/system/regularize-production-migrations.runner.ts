import type { MigrationRecoveryStepName } from './admin-migration-recovery.constants';
import type { MigrationRecoveryExecuteView } from './admin-migration-recovery.service';

export type RegularizeStepEvent =
  | { event: 'step-skipped'; step: MigrationRecoveryStepName; reason: 'already-applied' }
  | {
      event: 'step-complete';
      step: MigrationRecoveryStepName;
      ok: boolean;
      nextStep: MigrationRecoveryStepName | null;
    };

export type RegularizeRunResult = {
  events: RegularizeStepEvent[];
  allOk: boolean;
};

/**
 * Runs allowlisted recovery steps in order, skipping migrations already present
 * in Prisma history (no DDL / execute for those).
 */
export async function runAllowlistedRecoverySteps(
  allowlist: readonly MigrationRecoveryStepName[],
  appliedMigrations: Iterable<string>,
  executeStep: (
    step: MigrationRecoveryStepName,
  ) => Promise<MigrationRecoveryExecuteView>,
): Promise<RegularizeRunResult> {
  const applied = new Set(appliedMigrations);
  const events: RegularizeStepEvent[] = [];

  for (const step of allowlist) {
    if (applied.has(step)) {
      events.push({
        event: 'step-skipped',
        step,
        reason: 'already-applied',
      });
      continue;
    }

    const view = await executeStep(step);
    events.push({
      event: 'step-complete',
      step,
      ok: view.ok,
      nextStep: view.nextStep,
    });

    if (!view.ok) {
      return { events, allOk: false };
    }

    applied.add(step);
  }

  return { events, allOk: true };
}
