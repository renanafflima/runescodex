import { catalogRowsForSeed } from './rewards.mission-catalog';
import { MISSION_ROLES } from './rewards.constants';

/** Minimal Prisma surface used by catalog ensure (seed + runtime). */
export type RewardsCatalogPrisma = {
  rewardMission: {
    count: (args: {
      where: Record<string, unknown>;
    }) => Promise<number>;
    findMany: (args: {
      where: Record<string, unknown>;
      select?: { catalogKey: true; period: true };
    }) => Promise<Array<{ catalogKey: string | null; period: string }>>;
    findFirst: (args: {
      where: Record<string, unknown>;
      select?: { id: true };
    }) => Promise<{ id: string } | null>;
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<unknown>;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    createMany: (args: {
      data: Array<Record<string, unknown>>;
      skipDuplicates?: boolean;
    }) => Promise<{ count: number }>;
    updateMany: (args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => Promise<{ count: number }>;
  };
};

/** Fixed slots that must exist for 3+2+2 rotation to work. */
export const REQUIRED_CATALOG_V2_FIXED_KEYS = [
  'TRIBUTE_TO_GODS',
  'UNBREAKABLE_DEVOTION',
  'CODEX_LEGEND',
] as const;

/** Process-local cache: after a successful integrity check, skip further DB ensure work. */
let catalogReadyCache = false;

export function isRewardsCatalogReadyCached(): boolean {
  return catalogReadyCache;
}

export function markRewardsCatalogReady(): void {
  catalogReadyCache = true;
}

/** Test-only reset. */
export function resetRewardsCatalogReadyCache(): void {
  catalogReadyCache = false;
}

/**
 * True when the DB lacks a complete V2 fixed set (migration-only / partial ensure).
 * Single COUNT — safe for the hot path when cache is cold.
 */
export async function isRewardsCatalogV2Missing(
  prisma: RewardsCatalogPrisma,
): Promise<boolean> {
  const count = await prisma.rewardMission.count({
    where: {
      active: true,
      catalogKey: { in: [...REQUIRED_CATALOG_V2_FIXED_KEYS] },
    },
  });
  return count < REQUIRED_CATALOG_V2_FIXED_KEYS.length;
}

/**
 * Cheap gate for request handlers.
 * - Cached ready → zero queries.
 * - Otherwise one COUNT; if complete, mark ready and return.
 * - Only when incomplete, run the (rare) bulk ensure without an interactive transaction.
 */
export async function ensureRewardsCatalogV2IfNeeded(
  prisma: RewardsCatalogPrisma,
): Promise<{ skipped: boolean; upserted?: number; deactivatedLegacy?: number }> {
  if (catalogReadyCache) {
    return { skipped: true };
  }
  if (!(await isRewardsCatalogV2Missing(prisma))) {
    catalogReadyCache = true;
    return { skipped: true };
  }
  const result = await ensureRewardsCatalogV2(prisma);
  catalogReadyCache = true;
  return { skipped: false, ...result };
}

/**
 * Idempotent catalog bootstrap. Avoids interactive $transaction (P2028 on 63-row loops).
 * Uses createMany(skipDuplicates) + targeted updates. Safe under multi-instance races.
 * Does not touch wallets, ledger, receipts, redemptions, or progress.
 */
export async function ensureRewardsCatalogV2(
  prisma: RewardsCatalogPrisma,
): Promise<{ upserted: number; deactivatedLegacy: number }> {
  const rows = catalogRowsForSeed();
  const existing = await prisma.rewardMission.findMany({
    where: {
      catalogKey: { in: rows.map((row) => row.catalogKey) },
    },
    select: { catalogKey: true, period: true },
  });
  const have = new Set(
    existing.map((row) => `${row.catalogKey}:${row.period}`),
  );
  const missing = rows.filter(
    (row) => !have.has(`${row.catalogKey}:${row.period}`),
  );

  if (missing.length > 0) {
    await prisma.rewardMission.createMany({
      data: missing.map((row) => ({
        title: row.title,
        description: row.description,
        category: row.category,
        period: row.period,
        target: row.target,
        pointsReward: row.pointsReward,
        imageKey: row.imageKey,
        eventType: row.eventType,
        catalogKey: row.catalogKey,
        pillar: row.pillar,
        role: row.role,
        eventImplemented: row.eventImplemented,
        active: row.active,
      })),
      skipDuplicates: true,
    });
  }

  // Ensure fixed slots are active with correct roles even if a prior partial insert left them wrong.
  for (const key of REQUIRED_CATALOG_V2_FIXED_KEYS) {
    const def = rows.find((row) => row.catalogKey === key);
    if (!def) continue;
    await prisma.rewardMission.updateMany({
      where: { catalogKey: key, period: def.period },
      data: {
        title: def.title,
        description: def.description,
        category: def.category,
        target: def.target,
        pointsReward: def.pointsReward,
        imageKey: def.imageKey,
        eventType: def.eventType,
        pillar: def.pillar,
        role: def.role,
        eventImplemented: def.eventImplemented,
        active: true,
      },
    });
  }

  const deactivated = await prisma.rewardMission.updateMany({
    where: {
      OR: [{ role: MISSION_ROLES.LEGACY }, { catalogKey: null }],
      active: true,
    },
    data: { active: false, eventImplemented: false },
  });

  return {
    upserted: rows.length,
    deactivatedLegacy: deactivated.count,
  };
}
