import type { MissionPeriod } from './rewards.constants';
import {
  cycleKeyForPeriod,
  selectFeaturedForPeriod,
  type RotationMissionPick,
} from './rewards.rotation';
import { isImplementedRewardEvent } from './rewards.events';

export type GlobalRotationRow = {
  id: string;
  cycleKey: string;
  period: MissionPeriod;
  periodStart: Date;
  periodEnd: Date;
  missionIds: string[];
  createdAt: Date;
};

export type GlobalRotationPrisma = {
  rewardGlobalRotation: {
    findUnique: (args: {
      where: {
        period_periodStart: { period: MissionPeriod; periodStart: Date };
      };
    }) => Promise<GlobalRotationRow | null>;
    findMany: (args: {
      where: {
        OR: Array<{ period: MissionPeriod; periodStart: Date }>;
      };
    }) => Promise<GlobalRotationRow[]>;
    create: (args: {
      data: {
        id: string;
        cycleKey: string;
        period: MissionPeriod;
        periodStart: Date;
        periodEnd: Date;
        missionIds: string[];
      };
    }) => Promise<GlobalRotationRow>;
  };
  rewardMission: {
    findMany: (args: {
      where: Record<string, unknown>;
      select: Record<string, boolean>;
    }) => Promise<Array<RotationMissionPick & Record<string, unknown>>>;
  };
};

const MISSION_PICK_SELECT = {
  id: true,
  period: true,
  catalogKey: true,
  pillar: true,
  role: true,
  eventType: true,
  active: true,
  eventImplemented: true,
} as const;

/** In-process cache of the current cycle rotation (invalidated when periodStart changes). */
const rotationCache = new Map<string, GlobalRotationRow>();

export function resetGlobalRotationCache(): void {
  rotationCache.clear();
}

function cacheKey(period: MissionPeriod, periodStart: Date): string {
  return `${period}:${periodStart.toISOString()}`;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

function asPick(
  mission: RotationMissionPick & Record<string, unknown>,
): RotationMissionPick {
  const eventType = (mission.eventType as string | null) ?? null;
  return {
    id: mission.id,
    period: mission.period as MissionPeriod,
    catalogKey: (mission.catalogKey as string | null) ?? null,
    pillar: (mission.pillar as string | null) ?? null,
    role: (mission.role as string) ?? 'LEGACY',
    eventType,
    active: Boolean(mission.active),
    eventImplemented:
      Boolean(mission.eventImplemented) ||
      Boolean(eventType && isImplementedRewardEvent(eventType)),
  };
}

/**
 * Load or create the global rotation for one UTC cycle.
 * Selection is deterministic and shared by all users; concurrent creates resolve via P2002.
 */
export async function getOrCreateGlobalRotation(
  prisma: GlobalRotationPrisma,
  period: MissionPeriod,
  periodStart: Date,
  periodEnd: Date,
): Promise<GlobalRotationRow> {
  const key = cacheKey(period, periodStart);
  const cached = rotationCache.get(key);
  if (cached) return cached;

  const existing = await prisma.rewardGlobalRotation.findUnique({
    where: { period_periodStart: { period, periodStart } },
  });
  if (existing) {
    rotationCache.set(key, existing);
    return existing;
  }

  const candidates = await prisma.rewardMission.findMany({
    where: { active: true, period },
    select: MISSION_PICK_SELECT,
  });
  const picks = selectFeaturedForPeriod(
    candidates.map((m) => asPick(m)),
    period,
    periodStart,
  );
  const cycleKey = cycleKeyForPeriod(period, periodStart);
  const missionIds = picks.map((pick) => pick.id);

  try {
    const created = await prisma.rewardGlobalRotation.create({
      data: {
        id: crypto.randomUUID(),
        cycleKey,
        period,
        periodStart,
        periodEnd,
        missionIds,
      },
    });
    rotationCache.set(key, created);
    return created;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await prisma.rewardGlobalRotation.findUnique({
      where: { period_periodStart: { period, periodStart } },
    });
    if (!raced) throw error;
    rotationCache.set(key, raced);
    return raced;
  }
}

export async function getOrCreateGlobalRotationsForPeriods(
  prisma: GlobalRotationPrisma,
  at: Date,
  windows: Array<{
    period: MissionPeriod;
    periodStart: Date;
    periodEnd: Date;
  }>,
): Promise<Map<MissionPeriod, GlobalRotationRow>> {
  const result = new Map<MissionPeriod, GlobalRotationRow>();
  const missing: typeof windows = [];

  for (const window of windows) {
    const key = cacheKey(window.period, window.periodStart);
    const cached = rotationCache.get(key);
    if (cached) {
      result.set(window.period, cached);
      continue;
    }
    missing.push(window);
  }

  if (missing.length === 0) return result;

  const found = await prisma.rewardGlobalRotation.findMany({
    where: {
      OR: missing.map((window) => ({
        period: window.period,
        periodStart: window.periodStart,
      })),
    },
  });
  for (const row of found) {
    rotationCache.set(cacheKey(row.period, row.periodStart), row);
    result.set(row.period, row);
  }

  for (const window of missing) {
    if (result.has(window.period)) continue;
    const row = await getOrCreateGlobalRotation(
      prisma,
      window.period,
      window.periodStart,
      window.periodEnd,
    );
    result.set(window.period, row);
  }

  return result;
}
