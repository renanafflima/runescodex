import {
  BILLING_CHECKOUT_ATTEMPT_INDEXES,
  BOSSTIARY_ENUMS,
  BOSSTIARY_TABLES,
  COMMUNITY_ENUMS,
  COMMUNITY_PUBLISH_IDEMPOTENCY_INDEXES,
  COMMUNITY_TABLES,
  MIGRATION_RECOVERY_ALLOWLIST,
  type MigrationRecoveryStepName,
} from './admin-migration-recovery.constants';

export type MigrationRecoveryProbe = {
  migrationApplied(name: string): Promise<boolean>;
  indexExists(name: string): Promise<boolean>;
  tableExists(name: string): Promise<boolean>;
  enumExists(name: string): Promise<boolean>;
  columnExists(table: string, column: string): Promise<boolean>;
};

export type StepAssessment = {
  step: MigrationRecoveryStepName;
  migrationInHistory: boolean;
  /** DDL may run when physical objects are still missing. */
  readyForDdl: boolean;
  /** History may be marked applied without DDL when physical objects match migration. */
  readyForResolveOnly: boolean;
  blockedReasons: string[];
  details: Record<string, boolean>;
};

export type DiagnosticStepView = StepAssessment & {
  ordinal: number;
  isNextExecutable: boolean;
};

function priorStepsApplied(
  step: MigrationRecoveryStepName,
  applied: Set<string>,
): boolean {
  const index = MIGRATION_RECOVERY_ALLOWLIST.indexOf(step);
  if (index <= 0) {
    return true;
  }
  for (let i = 0; i < index; i += 1) {
    if (!applied.has(MIGRATION_RECOVERY_ALLOWLIST[i])) {
      return false;
    }
  }
  return true;
}

export async function assessHuntVocationIndexes(
  probe: MigrationRecoveryProbe,
): Promise<Pick<StepAssessment, 'readyForDdl' | 'readyForResolveOnly' | 'blockedReasons' | 'details'>> {
  const keyExists = await probe.indexExists('HuntVocation_huntId_vocation_key');
  const idxExists = await probe.indexExists('HuntVocation_huntId_vocation_idx');
  const details = { huntVocationUniqueKey: keyExists, huntVocationCompositeIdx: idxExists };
  const blockedReasons: string[] = [];

  if (idxExists && !keyExists) {
    return {
      readyForDdl: false,
      readyForResolveOnly: true,
      blockedReasons,
      details,
    };
  }

  if (idxExists && keyExists) {
    blockedReasons.push(
      'Both HuntVocation indexes are present; manual review required before DROP.',
    );
    return {
      readyForDdl: false,
      readyForResolveOnly: false,
      blockedReasons,
      details,
    };
  }

  if (!idxExists) {
    return {
      readyForDdl: true,
      readyForResolveOnly: false,
      blockedReasons,
      details,
    };
  }

  blockedReasons.push('Unexpected HuntVocation index state.');
  return {
    readyForDdl: false,
    readyForResolveOnly: false,
    blockedReasons,
    details,
  };
}

async function assessBosstiaryComplete(
  probe: MigrationRecoveryProbe,
): Promise<{ ok: boolean; details: Record<string, boolean> }> {
  const details: Record<string, boolean> = {};
  for (const name of BOSSTIARY_ENUMS) {
    details[`enum:${name}`] = await probe.enumExists(name);
  }
  for (const name of BOSSTIARY_TABLES) {
    details[`table:${name}`] = await probe.tableExists(name);
  }
  details['index:BosstiaryBoss_slug_key'] = await probe.indexExists(
    'BosstiaryBoss_slug_key',
  );
  const ok = Object.values(details).every(Boolean);
  return { ok, details };
}

async function assessBillingCheckoutAttemptComplete(
  probe: MigrationRecoveryProbe,
): Promise<{ ok: boolean; details: Record<string, boolean> }> {
  const details: Record<string, boolean> = {
    billingCheckoutAttemptStateEnum: await probe.enumExists(
      'BillingCheckoutAttemptState',
    ),
    billingCheckoutAttemptTable: await probe.tableExists('BillingCheckoutAttempt'),
  };
  for (const indexName of BILLING_CHECKOUT_ATTEMPT_INDEXES) {
    details[`index:${indexName}`] = await probe.indexExists(indexName);
  }
  const ok = Object.values(details).every(Boolean);
  return { ok, details };
}

async function assessCommunityPublishIdempotencyComplete(
  probe: MigrationRecoveryProbe,
): Promise<{ ok: boolean; details: Record<string, boolean> }> {
  const details: Record<string, boolean> = {
    communityRotationPublishIdempotency: await probe.tableExists(
      'CommunityRotationPublishIdempotency',
    ),
  };
  for (const indexName of COMMUNITY_PUBLISH_IDEMPOTENCY_INDEXES) {
    details[`index:${indexName}`] = await probe.indexExists(indexName);
  }
  const ok = Object.values(details).every(Boolean);
  return { ok, details };
}

async function assessCommunityComplete(
  probe: MigrationRecoveryProbe,
): Promise<{ ok: boolean; details: Record<string, boolean> }> {
  const details: Record<string, boolean> = {};
  for (const name of COMMUNITY_ENUMS) {
    details[`enum:${name}`] = await probe.enumExists(name);
  }
  for (const name of COMMUNITY_TABLES) {
    details[`table:${name}`] = await probe.tableExists(name);
  }
  const ok = Object.values(details).every(Boolean);
  return { ok, details };
}

export async function assessRecoveryStep(
  probe: MigrationRecoveryProbe,
  step: MigrationRecoveryStepName,
  applied: Set<string>,
): Promise<StepAssessment> {
  const migrationInHistory = applied.has(step);
  const blockedReasons: string[] = [];

  if (migrationInHistory) {
    return {
      step,
      migrationInHistory: true,
      readyForDdl: false,
      readyForResolveOnly: false,
      blockedReasons: ['Migration already recorded in _prisma_migrations.'],
      details: {},
    };
  }

  if (!priorStepsApplied(step, applied)) {
    blockedReasons.push('Previous allowlisted migration is not applied yet.');
    return {
      step,
      migrationInHistory: false,
      readyForDdl: false,
      readyForResolveOnly: false,
      blockedReasons,
      details: {},
    };
  }

  switch (step) {
    case '20261103000000_hunt_vocation_multiple_level_ranges': {
      const part = await assessHuntVocationIndexes(probe);
      return { step, migrationInHistory: false, ...part };
    }
    case '20261103120000_hunt_update_request_vocation_range': {
      const min = await probe.columnExists('HuntUpdateRequest', 'rangeLevelMin');
      const max = await probe.columnExists('HuntUpdateRequest', 'rangeLevelMax');
      const details = { rangeLevelMin: min, rangeLevelMax: max };
      if (min && max) {
        return {
          step,
          migrationInHistory: false,
          readyForDdl: false,
          readyForResolveOnly: true,
          blockedReasons,
          details,
        };
      }
      return {
        step,
        migrationInHistory: false,
        readyForDdl: true,
        readyForResolveOnly: false,
        blockedReasons,
        details,
      };
    }
    case '20261103143000_billing_checkout_attempt': {
      const billing = await assessBillingCheckoutAttemptComplete(probe);
      if (billing.ok) {
        return {
          step,
          migrationInHistory: false,
          readyForDdl: false,
          readyForResolveOnly: true,
          blockedReasons,
          details: billing.details,
        };
      }
      const table = billing.details.billingCheckoutAttemptTable;
      if (!table) {
        return {
          step,
          migrationInHistory: false,
          readyForDdl: true,
          readyForResolveOnly: false,
          blockedReasons,
          details: billing.details,
        };
      }
      blockedReasons.push(
        'BillingCheckoutAttempt is partially present; complete DDL before resolve.',
      );
      return {
        step,
        migrationInHistory: false,
        readyForDdl: false,
        readyForResolveOnly: false,
        blockedReasons,
        details: billing.details,
      };
    }
    case '20261104090000_add_bosstiary': {
      const bosstiary = await assessBosstiaryComplete(probe);
      if (!bosstiary.ok) {
        blockedReasons.push('Bosstiary physical objects incomplete.');
      }
      return {
        step,
        migrationInHistory: false,
        readyForDdl: false,
        readyForResolveOnly: bosstiary.ok,
        blockedReasons,
        details: bosstiary.details,
      };
    }
    case '20261107120000_add_community_rotations': {
      const community = await assessCommunityComplete(probe);
      if (!community.ok) {
        blockedReasons.push('Community rotation objects incomplete.');
      }
      return {
        step,
        migrationInHistory: false,
        readyForDdl: false,
        readyForResolveOnly: community.ok,
        blockedReasons,
        details: community.details,
      };
    }
    case '20261107143000_community_rotation_publish_idempotency': {
      const idempotency = await assessCommunityPublishIdempotencyComplete(probe);
      if (idempotency.ok) {
        return {
          step,
          migrationInHistory: false,
          readyForDdl: false,
          readyForResolveOnly: true,
          blockedReasons,
          details: idempotency.details,
        };
      }
      const table = idempotency.details.communityRotationPublishIdempotency;
      if (!table) {
        return {
          step,
          migrationInHistory: false,
          readyForDdl: true,
          readyForResolveOnly: false,
          blockedReasons,
          details: idempotency.details,
        };
      }
      blockedReasons.push(
        'CommunityRotationPublishIdempotency is partially present; complete DDL before resolve.',
      );
      return {
        step,
        migrationInHistory: false,
        readyForDdl: false,
        readyForResolveOnly: false,
        blockedReasons,
        details: idempotency.details,
      };
    }
    case '20261107143500_drop_community_rotation_sort_enum': {
      const sortEnum = await probe.enumExists('CommunityRotationSort');
      const details = { communityRotationSortEnum: sortEnum };
      if (sortEnum) {
        return {
          step,
          migrationInHistory: false,
          readyForDdl: true,
          readyForResolveOnly: false,
          blockedReasons,
          details,
        };
      }
      return {
        step,
        migrationInHistory: false,
        readyForDdl: false,
        readyForResolveOnly: true,
        blockedReasons,
        details,
      };
    }
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
}

export function pickNextExecutableStep(
  assessments: StepAssessment[],
): MigrationRecoveryStepName | null {
  for (const item of assessments) {
    if (item.migrationInHistory) {
      continue;
    }
    const index = MIGRATION_RECOVERY_ALLOWLIST.indexOf(item.step);
    for (let i = 0; i < index; i += 1) {
      const prior = assessments.find(
        (row) => row.step === MIGRATION_RECOVERY_ALLOWLIST[i],
      );
      if (prior && !prior.migrationInHistory) {
        return item.step;
      }
    }
    if (item.readyForDdl || item.readyForResolveOnly) {
      return item.step;
    }
    return item.step;
  }
  return null;
}

export function buildDiagnosticSteps(
  assessments: StepAssessment[],
): DiagnosticStepView[] {
  const next = pickNextExecutableStep(assessments);
  return assessments.map((item, index) => ({
    ...item,
    ordinal: index + 1,
    isNextExecutable:
      next === item.step &&
      !item.migrationInHistory &&
      (item.readyForDdl || item.readyForResolveOnly),
  }));
}
