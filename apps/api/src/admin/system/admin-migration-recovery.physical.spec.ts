import {
  assessHuntVocationIndexes,
  assessRecoveryStep,
  type MigrationRecoveryProbe,
} from './admin-migration-recovery.physical';

function probeFrom(
  state: Partial<{
    indexes: Record<string, boolean>;
    tables: Record<string, boolean>;
    enums: Record<string, boolean>;
    columns: Record<string, boolean>;
    applied: string[];
  }>,
): MigrationRecoveryProbe {
  const applied = new Set(state.applied ?? []);
  return {
    migrationApplied: async (name) => applied.has(name),
    indexExists: async (name) => Boolean(state.indexes?.[name]),
    tableExists: async (name) => Boolean(state.tables?.[name]),
    enumExists: async (name) => Boolean(state.enums?.[name]),
    columnExists: async (table, column) =>
      Boolean(state.columns?.[`${table}.${column}`]),
  };
}

describe('assessHuntVocationIndexes', () => {
  it('allows resolve-only when composite index exists and unique is gone', async () => {
    const result = await assessHuntVocationIndexes(
      probeFrom({
        indexes: {
          HuntVocation_huntId_vocation_idx: true,
          HuntVocation_huntId_vocation_key: false,
        },
      }),
    );
    expect(result.readyForResolveOnly).toBe(true);
    expect(result.readyForDdl).toBe(false);
  });

  it('blocks when both indexes are present', async () => {
    const result = await assessHuntVocationIndexes(
      probeFrom({
        indexes: {
          HuntVocation_huntId_vocation_idx: true,
          HuntVocation_huntId_vocation_key: true,
        },
      }),
    );
    expect(result.readyForResolveOnly).toBe(false);
    expect(result.blockedReasons.length).toBeGreaterThan(0);
  });

  it('allows ddl when composite index is missing', async () => {
    const result = await assessHuntVocationIndexes(
      probeFrom({
        indexes: {
          HuntVocation_huntId_vocation_idx: false,
          HuntVocation_huntId_vocation_key: false,
        },
      }),
    );
    expect(result.readyForDdl).toBe(true);
  });
});

describe('assessRecoveryStep', () => {
  it('requires ddl for hunt update columns when missing', async () => {
    const applied = new Set([
      '20261103000000_hunt_vocation_multiple_level_ranges',
    ]);
    const result = await assessRecoveryStep(
      probeFrom({
        columns: {
          'HuntUpdateRequest.rangeLevelMin': false,
          'HuntUpdateRequest.rangeLevelMax': false,
        },
      }),
      '20261103120000_hunt_update_request_vocation_range',
      applied,
    );
    expect(result.readyForDdl).toBe(true);
    expect(result.readyForResolveOnly).toBe(false);
  });

  it('never resolves bosstiary when tables are missing', async () => {
    const applied = new Set([
      '20261103000000_hunt_vocation_multiple_level_ranges',
      '20261103120000_hunt_update_request_vocation_range',
      '20261103143000_billing_checkout_attempt',
    ]);
    const result = await assessRecoveryStep(
      probeFrom({
        tables: { BosstiaryBoss: false },
        enums: { BosstiaryHuntMode: true },
      }),
      '20261104090000_add_bosstiary',
      applied,
    );
    expect(result.readyForResolveOnly).toBe(false);
    expect(result.blockedReasons).toContain(
      'Bosstiary physical objects incomplete.',
    );
  });

  it('requires ddl for bosstiary progress when tables are missing', async () => {
    const applied = new Set([
      '20261103000000_hunt_vocation_multiple_level_ranges',
      '20261103120000_hunt_update_request_vocation_range',
      '20261103143000_billing_checkout_attempt',
      '20261104090000_add_bosstiary',
      '20261107120000_add_community_rotations',
      '20261107143000_community_rotation_publish_idempotency',
      '20261107143500_drop_community_rotation_sort_enum',
    ]);
    const result = await assessRecoveryStep(
      probeFrom({ tables: { BosstiaryProgressActivity: false } }),
      '20261109180000_add_bosstiary_progress',
      applied,
    );
    expect(result.readyForDdl).toBe(true);
  });

  it('allows resolve-only for party hunt when physical objects exist', async () => {
    const applied = new Set([
      '20261103000000_hunt_vocation_multiple_level_ranges',
      '20261103120000_hunt_update_request_vocation_range',
      '20261103143000_billing_checkout_attempt',
      '20261104090000_add_bosstiary',
      '20261107120000_add_community_rotations',
      '20261107143000_community_rotation_publish_idempotency',
      '20261107143500_drop_community_rotation_sort_enum',
      '20261109180000_add_bosstiary_progress',
      '20261109190000_unique_community_rotation_test',
    ]);
    const result = await assessRecoveryStep(
      probeFrom({
        enums: {
          PartyStatus: true,
          PartyMemberRole: true,
          PartyMemberStatus: true,
          PartyInvitationStatus: true,
          HuntSessionStatus: true,
          HuntSessionParticipantStatus: true,
          AppNotificationKind: true,
        },
        tables: {
          Party: true,
          PartyMember: true,
          PartyInvitation: true,
          HuntSession: true,
          HuntSessionParticipant: true,
          AppNotification: true,
        },
        indexes: {
          PartyMember_partyId_userId_key: true,
          PartyInvitation_party_email_pending_key: true,
          HuntSessionParticipant_sessionId_userId_key: true,
          BosstiaryProgressActivity_partyId_visibility_occurredAt_idx: true,
        },
        columns: {
          'BosstiaryProgressActivity.partyId': true,
        },
      }),
      '20261109200000_add_party_hunt_sessions',
      applied,
    );
    expect(result.readyForResolveOnly).toBe(true);
    expect(result.readyForDdl).toBe(false);
  });

  it('treats CommunityRotationSort drop as ddl when enum still exists', async () => {
    const applied = new Set([
      '20261103000000_hunt_vocation_multiple_level_ranges',
      '20261103120000_hunt_update_request_vocation_range',
      '20261103143000_billing_checkout_attempt',
      '20261104090000_add_bosstiary',
      '20261107120000_add_community_rotations',
      '20261107143000_community_rotation_publish_idempotency',
    ]);
    const result = await assessRecoveryStep(
      probeFrom({ enums: { CommunityRotationSort: true } }),
      '20261107143500_drop_community_rotation_sort_enum',
      applied,
    );
    expect(result.readyForDdl).toBe(true);
    expect(result.readyForResolveOnly).toBe(false);
  });
});
