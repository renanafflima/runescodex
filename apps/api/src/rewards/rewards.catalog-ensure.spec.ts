import {
  REQUIRED_CATALOG_V2_FIXED_KEYS,
  ensureRewardsCatalogV2,
  isRewardsCatalogV2Missing,
} from './rewards.catalog-ensure';
import { MISSION_ROLES } from './rewards.constants';

describe('rewards catalog ensure', () => {
  it('detects missing V2 when any fixed catalog key is absent', async () => {
    const prisma = {
      rewardMission: {
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
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

  it('treats catalog as present only when all three fixed keys exist', async () => {
    const prisma = {
      rewardMission: {
        count: jest.fn().mockResolvedValue(3),
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    await expect(isRewardsCatalogV2Missing(prisma)).resolves.toBe(false);
  });

  it('upserts 63 catalog rows and deactivates LEGACY without deletes', async () => {
    const created: string[] = [];
    const prisma = {
      rewardMission: {
        count: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => {
          created.push(`${data.catalogKey}:${data.period}`);
          return Promise.resolve({ id: data.catalogKey });
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 5 }),
      },
    };

    const result = await ensureRewardsCatalogV2(prisma);
    expect(result.upserted).toBe(63);
    expect(result.deactivatedLegacy).toBe(5);
    expect(created).toHaveLength(63);
    expect(created).toContain('TRIBUTE_TO_GODS:DAILY');
    expect(created).toContain('UNBREAKABLE_DEVOTION:WEEKLY');
    expect(created).toContain('CODEX_LEGEND:MONTHLY');
    expect(prisma.rewardMission.updateMany).toHaveBeenCalledWith({
      where: {
        OR: [{ role: MISSION_ROLES.LEGACY }, { catalogKey: null }],
        active: true,
      },
      data: { active: false, eventImplemented: false },
    });
  });

  it('recovers from concurrent create unique violations (P2002)', async () => {
    const prisma = {
      rewardMission: {
        count: jest.fn(),
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'raced-id' }),
        create: jest.fn().mockRejectedValue({ code: 'P2002' }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    // Only one row path exercised via direct helper through ensure — stub catalog
    // by running ensure and letting create fail once then update. To keep the test
    // focused, call ensure with a prisma that fails every create then updates.
    prisma.rewardMission.findFirst.mockImplementation(() =>
      Promise.resolve(
        prisma.rewardMission.create.mock.calls.length > 0
          ? { id: 'raced-id' }
          : null,
      ),
    );
    // Simpler: first find null, create P2002, second find id, update.
    let finds = 0;
    prisma.rewardMission.findFirst.mockImplementation(() => {
      finds += 1;
      // Odd finds are pre-create checks (null), even are post-P2002 lookups.
      if (finds % 2 === 1) return Promise.resolve(null);
      return Promise.resolve({ id: `raced-${finds}` });
    });

    const result = await ensureRewardsCatalogV2(prisma);
    expect(result.upserted).toBe(63);
    expect(prisma.rewardMission.update).toHaveBeenCalled();
    expect(prisma.rewardMission.create).toHaveBeenCalled();
  });

  it('runs inside $transaction when provided', async () => {
    const inner = {
      rewardMission: {
        count: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ id: 'existing' }),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (fn: (tx: typeof inner) => Promise<unknown>) =>
        fn(inner),
      ),
      rewardMission: inner.rewardMission,
    };

    await ensureRewardsCatalogV2(prisma);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(inner.rewardMission.create).not.toHaveBeenCalled();
    expect(inner.rewardMission.update).toHaveBeenCalledTimes(63);
  });
});
