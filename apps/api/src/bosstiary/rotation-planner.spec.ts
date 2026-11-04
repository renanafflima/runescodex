import {
  BosstiaryAccessStatus,
  BosstiaryHuntMode,
  BosstiaryRotationKind,
  Vocation,
} from '../../generated/prisma/client.js';
import {
  isEligibleForRotation,
  planBosstiaryRotations,
  travelMinutesBetween,
  type PlannerBoss,
} from './rotation-planner';

function boss(overrides: Partial<PlannerBoss> = {}): PlannerBoss {
  return {
    slug: 'the-welter',
    name: 'The Welter',
    huntMode: BosstiaryHuntMode.SOLO,
    recommendedLevel: 500,
    originCity: 'Thais',
    locationName: 'Thais',
    locationRegion: 'Mainland',
    accessStatus: BosstiaryAccessStatus.NONE,
    accessRequirements: null,
    cooldownSeconds: 3600,
    estimatedCombatMinutes: 4,
    bossPoints: 30,
    vocations: [],
    ...overrides,
  };
}

const travel = [
  { fromCity: 'Thais', toCity: 'Venore', minutes: 6 },
  { fromCity: 'Thais', toCity: 'Edron', minutes: 20 },
];

describe('bosstiary rotation planner', () => {
  it('treats the same city as zero travel and unknown cities as missing data', () => {
    expect(travelMinutesBetween('Thais', 'Thais', travel)).toBe(0);
    expect(travelMinutesBetween('Thais', 'Venore', travel)).toBe(6);
    expect(travelMinutesBetween('Venore', 'Thais', travel)).toBe(6);
    expect(travelMinutesBetween('Thais', 'Yalahar', travel)).toBeNull();
  });

  it('rejects bosses that lack reviewed combat time, access, level or hunt mode', () => {
    const input = { level: 500, huntMode: BosstiaryHuntMode.SOLO, vocation: Vocation.EK };
    expect(isEligibleForRotation(boss(), input)).toBe(true);
    expect(isEligibleForRotation(boss({ estimatedCombatMinutes: null }), input)).toBe(false);
    expect(isEligibleForRotation(boss({ accessStatus: BosstiaryAccessStatus.UNKNOWN }), input)).toBe(false);
    expect(isEligibleForRotation(boss({ accessStatus: BosstiaryAccessStatus.REQUIRED }), input)).toBe(false);
    expect(isEligibleForRotation(boss({ recommendedLevel: null }), input)).toBe(false);
    expect(isEligibleForRotation(boss({ huntMode: BosstiaryHuntMode.PARTY }), input)).toBe(false);
    expect(isEligibleForRotation(boss({ recommendedLevel: 700 }), input)).toBe(false);
  });

  it('does not assume the player has a vocation-restricted boss', () => {
    const input = { level: 800, huntMode: BosstiaryHuntMode.SOLO, vocation: Vocation.EK };
    expect(isEligibleForRotation(boss({ vocations: [Vocation.MS] }), input)).toBe(false);
    expect(isEligibleForRotation(boss({ vocations: [Vocation.EK] }), input)).toBe(true);
  });

  it('does not use cooldown as combat time and skips a route that would exceed the window', () => {
    const result = planBosstiaryRotations({
      availableMinutes: 15,
      level: 500,
      huntMode: BosstiaryHuntMode.SOLO,
      vocation: Vocation.EK,
      originCity: 'Thais',
      travel,
      bosses: [
        boss({
          slug: 'slow-boss',
          estimatedCombatMinutes: 14,
          cooldownSeconds: 1,
          originCity: 'Edron',
        }),
      ],
    });
    expect(result.items).toEqual([]);
    expect(result.emptyReason).toMatch(/não cabem no tempo/i);
  });

  it('prefers nearby bosses that fill the window over a distant extra boss', () => {
    const result = planBosstiaryRotations({
      availableMinutes: 15,
      level: 500,
      huntMode: BosstiaryHuntMode.SOLO,
      vocation: Vocation.EK,
      originCity: 'Thais',
      travel,
      bosses: [
        boss({ slug: 'near-one', name: 'Near One', originCity: 'Thais', estimatedCombatMinutes: 4, bossPoints: 10 }),
        boss({ slug: 'near-two', name: 'Near Two', originCity: 'Thais', estimatedCombatMinutes: 4, bossPoints: 10 }),
        boss({ slug: 'near-three', name: 'Near Three', originCity: 'Thais', estimatedCombatMinutes: 4, bossPoints: 10 }),
        boss({ slug: 'far-boss', name: 'Far Boss', originCity: 'Edron', estimatedCombatMinutes: 4, bossPoints: 80 }),
      ],
    });
    const express = result.items.find((item) => item.kind === BosstiaryRotationKind.EXPRESS);
    expect(express?.bossCount).toBe(3);
    expect(express?.stops.every((stop) => stop.originCity === 'Thais')).toBe(true);
    expect(express?.totalMinutes).toBeLessThanOrEqual(15);
    expect(express?.stops.some((stop) => stop.slug === 'far-boss')).toBe(false);
  });

  it('omits efficiency when boss points are missing', () => {
    const result = planBosstiaryRotations({
      availableMinutes: 15,
      level: 500,
      huntMode: BosstiaryHuntMode.SOLO,
      vocation: Vocation.EK,
      originCity: 'Thais',
      travel,
      bosses: [boss({ slug: 'no-points', bossPoints: null, estimatedCombatMinutes: 5 })],
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].pointsPerMinute).toBeNull();
  });

  it('returns a structured empty state when the catalog has no reviewed bosses', () => {
    const result = planBosstiaryRotations({
      availableMinutes: 20,
      level: 300,
      huntMode: BosstiaryHuntMode.PARTY,
      vocation: Vocation.RP,
      originCity: 'Edron',
      travel: [],
      bosses: [],
    });
    expect(result.items).toEqual([]);
    expect(result.emptyReason).toMatch(/não há bosses revisados/i);
  });

  it('does not repeat a boss inside the available window', () => {
    const result = planBosstiaryRotations({
      availableMinutes: 60,
      level: 500,
      huntMode: BosstiaryHuntMode.SOLO,
      vocation: Vocation.EK,
      originCity: 'Thais',
      travel,
      bosses: [boss({ slug: 'only-one', estimatedCombatMinutes: 5, cooldownSeconds: 60 })],
    });
    expect(result.items[0].bossCount).toBe(1);
  });
});
