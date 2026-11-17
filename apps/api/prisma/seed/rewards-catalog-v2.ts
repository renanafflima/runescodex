import { catalogRowsForSeed } from '../../src/rewards/rewards.mission-catalog.js';

/**
 * Upserts the v2 mission catalog by (catalogKey, period).
 * Deactivates legacy missions that are still LEGACY/active so they leave rotation,
 * without deleting rows or progress history.
 */
export async function seedRewardsCatalogV2(prisma: {
  rewardMission: {
    findFirst: (args: unknown) => Promise<{ id: string } | null>;
    update: (args: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<unknown>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
  };
}) {
  const rows = catalogRowsForSeed();
  for (const row of rows) {
    const existing = await prisma.rewardMission.findFirst({
      where: { catalogKey: row.catalogKey, period: row.period },
    });
    const data = {
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
    };
    if (existing) {
      await prisma.rewardMission.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.rewardMission.create({ data });
    }
  }

  const deactivated = await prisma.rewardMission.updateMany({
    where: {
      OR: [{ role: 'LEGACY' }, { catalogKey: null }],
      active: true,
    },
    data: { active: false, eventImplemented: false },
  });

  console.log(
    `Seeded ${rows.length} catalog v2 missions; deactivated ${deactivated.count} legacy active missions (history preserved).`,
  );
}