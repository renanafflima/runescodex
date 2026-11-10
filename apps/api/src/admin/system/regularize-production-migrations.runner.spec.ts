import { MIGRATION_RECOVERY_ALLOWLIST } from './admin-migration-recovery.constants';
import { runAllowlistedRecoverySteps } from './regularize-production-migrations.runner';

describe('runAllowlistedRecoverySteps', () => {
  it('skips migrations already in the applied set without calling executeStep', async () => {
    const executed: string[] = [];
    const first = MIGRATION_RECOVERY_ALLOWLIST[0];
    const second = MIGRATION_RECOVERY_ALLOWLIST[1];

    const { events, allOk } = await runAllowlistedRecoverySteps(
      MIGRATION_RECOVERY_ALLOWLIST,
      new Set([first]),
      async (step) => {
        executed.push(step);
        return {
          temporary: true,
          ok: true,
          step,
          action: 'resolve-only',
          logs: [],
          nextStep: null,
        };
      },
    );

    expect(allOk).toBe(true);
    expect(events[0]).toEqual({
      event: 'step-skipped',
      step: first,
      reason: 'already-applied',
    });
    expect(executed).not.toContain(first);
    expect(executed[0]).toBe(second);
    expect(events.some((e) => e.event === 'step-complete' && e.step === second)).toBe(
      true,
    );
  });

  it('executes pending steps in allowlist order and tracks newly applied steps', async () => {
    const order: string[] = [];
    const appliedSeed = MIGRATION_RECOVERY_ALLOWLIST.slice(0, 2);

    const { events, allOk } = await runAllowlistedRecoverySteps(
      MIGRATION_RECOVERY_ALLOWLIST,
      appliedSeed,
      async (step) => {
        order.push(step);
        return {
          temporary: true,
          ok: true,
          step,
          action: 'resolve-only',
          logs: [],
          nextStep: null,
        };
      },
    );

    expect(allOk).toBe(true);
    expect(order).toEqual(MIGRATION_RECOVERY_ALLOWLIST.slice(2));
    const skipped = events.filter((e) => e.event === 'step-skipped');
    expect(skipped).toHaveLength(2);
    expect(events.at(-1)?.event).toBe('step-complete');
  });

  it('stops after a failed step without running later migrations', async () => {
    const failStep = MIGRATION_RECOVERY_ALLOWLIST[2];
    const executed: string[] = [];

    const { events, allOk } = await runAllowlistedRecoverySteps(
      MIGRATION_RECOVERY_ALLOWLIST,
      [],
      async (step) => {
        executed.push(step);
        if (step === failStep) {
          return {
            temporary: true,
            ok: false,
            step,
            action: 'resolve-only',
            logs: [],
            nextStep: null,
            error: 'failed',
          };
        }
        return {
          temporary: true,
          ok: true,
          step,
          action: 'resolve-only',
          logs: [],
          nextStep: null,
        };
      },
    );

    expect(allOk).toBe(false);
    expect(executed).toEqual(MIGRATION_RECOVERY_ALLOWLIST.slice(0, 3));
    const failed = events.find((e) => e.event === 'step-complete' && e.step === failStep);
    expect(failed).toMatchObject({ ok: false });
  });
});
