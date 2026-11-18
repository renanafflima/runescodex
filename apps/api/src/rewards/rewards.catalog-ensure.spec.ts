import {
  REQUIRED_CATALOG_V2_FIXED_KEYS,
  ensureRewardsCatalogV2,
  ensureRewardsCatalogV2IfNeeded,
  isRewardsCatalogReadyCached,
  isRewardsCatalogV2Missing,
  resetRewardsCatalogReadyCache,
} from './rewards.catalog-ensure';
import { MISSION_ROLES } from './rewards.constants';

describe('rewards catalog ensure', () => {
  beforeEach(() => {
    resetRewardsCatalogReadyCache();
  });

  it('detects missing V2 when any fixed catalog key is absent', async () => {
    const prisma = {
      rewardMission: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    await expect(isRewardsCatalogV2Missing(prisma)).resolves.toBe(true);
    expect(prisma.rewardMission.count).toHaveBeenCalledWith({
      where: {
        active: true,
        catalogKey: { in: [...REQUIRED_CATALOG_V2_FIXED_KEYS] },
      },
    });
  });

  it('skips upserts on the hot path when catalog is complete', async () => {
    const prisma = {
      rewardMission: {
        count: jest.fn().mockResolvedValue(3),
        findMany: jest.fn(),
        createMany: jest.fn(),
        updateMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    const first = await ensureRewardsCatalogV2IfNeeded(prisma);
    const second = await ensureRewardsCatalogV2IfNeeded(prisma);
    expect(first.skipped).toBe(true);
    expect(second.skipped).toBe(true);
    expect(prisma.rewardMission.count).toHaveBeenCalledTimes(1);
    expect(prisma.rewardMission.createMany).not.toHaveBeenCalled();
    expect(isRewardsCatalogReadyCached()).toBe(true);
  });

  it('bootstraps missing rows with createMany without interactive transaction', async () => {
    const prisma = {
      rewardMission: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 63 }),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };

    const result = await ensureRewardsCatalogV2(prisma);
    expect(result.upserted).toBe(63);
    expect(prisma.rewardMission.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: expect.arrayContaining([
          expect.objectContaining({ catalogKey: 'TRIBUTE_TO_GODS' }),
        ]),
      }),
    );
    expect(prisma.rewardMission.updateMany).toHaveBeenCalledWith({
      where: {
        OR: [{ role: MISSION_ROLES.LEGACY }, { catalogKey: null }],
        active: true,
      },
      data: { active: false, eventImplemented: false },
    });
  });
});
