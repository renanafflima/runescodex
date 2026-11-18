import { catalogRowsForSeed } from './rewards.mission-catalog';
import { MISSION_ROLES } from './rewards.constants';

/** Minimal Prisma surface used by catalog ensure (seed + runtime). */
export type RewardsCatalogPrisma = {
  $transaction?: <T>(
    fn: (tx: RewardsCatalogPrisma) => Promise<T>,
  ) => Promise<T>;
  rewardMission: {
    count: (args: {
      where: Record<string, unknown>;
    }) => Promise<number>;
    findFirst: (args: {
      where: Record<string, unknown>;
      select?: { id: true };
    }) => Promise<{ id: string } | null>;
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<unknown>;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
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

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/**
 * True when the DB lacks a complete V2 fixed set (migration-only / partial ensure).
 * Requires all three fixed catalog keys so a partial upsert cannot skip remaining rows.
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

async function upsertCatalogRow(
  prisma: RewardsCatalogPrisma,
  data: Record<string, unknown>,
) {
  const existing = await prisma.rewardMission.findFirst({
    where: { catalogKey: data.catalogKey, period: data.period },
    select: { id: true },
  });
  if (existing) {
    await prisma.rewardMission.update({
      where: { id: existing.id },
      data,
    });
    return;
  }

  try {
    await prisma.rewardMission.create({ data });
  } catch (error) {
    // Concurrent ensure on another instance may have created the same row.
    if (!isUniqueViolation(error)) throw error;
    const raced = await prisma.rewardMission.findFirst({
      where: { catalogKey: data.catalogKey, period: data.period },
      select: { id: true },
    });
    if (!raced) throw error;
    await prisma.rewardMission.update({
      where: { id: raced.id },
      data,
    });
  }
}

async function ensureRewardsCatalogV2Within(
  prisma: RewardsCatalogPrisma,
): Promise<{ upserted: number; deactivatedLegacy: number }> {
  const rows = catalogRowsForSeed();
  let upserted = 0;

  for (const row of rows) {
    await upsertCatalogRow(prisma, {
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
    });
    upserted += 1;
  }

  const deactivated = await prisma.rewardMission.updateMany({
    where: {
      OR: [{ role: MISSION_ROLES.LEGACY }, { catalogKey: null }],
      active: true,
    },
    data: { active: false, eventImplemented: false },
  });

  return { upserted, deactivatedLegacy: deactivated.count };
}

/**
 * Idempotent upsert of catalog v2 + deactivate LEGACY.
 * Does not touch wallets, ledger, receipts, redemptions, or progress rows.
 * Uses a transaction when available so a crash cannot leave a partial catalog
 * that would skip further ensures.
 */
export async function ensureRewardsCatalogV2(
  prisma: RewardsCatalogPrisma,
): Promise<{ upserted: number; deactivatedLegacy: number }> {
  if (typeof prisma.$transaction === 'function') {
    return prisma.$transaction((tx) => ensureRewardsCatalogV2Within(tx));
  }
  return ensureRewardsCatalogV2Within(prisma);
}
