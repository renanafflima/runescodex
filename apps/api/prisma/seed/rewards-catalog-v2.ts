import { ensureRewardsCatalogV2 } from '../../src/rewards/rewards.catalog-ensure.js';

/**
 * Upserts the v2 mission catalog by (catalogKey, period).
 * Deactivates legacy missions that are still LEGACY/active so they leave rotation,
 * without deleting rows or progress history.
 */
export async function seedRewardsCatalogV2(prisma: Parameters<
  typeof ensureRewardsCatalogV2
>[0]) {
  const result = await ensureRewardsCatalogV2(prisma);
  console.log(
    `Seeded ${result.upserted} catalog v2 missions; deactivated ${result.deactivatedLegacy} legacy active missions (history preserved).`,
  );
  return result;
}
