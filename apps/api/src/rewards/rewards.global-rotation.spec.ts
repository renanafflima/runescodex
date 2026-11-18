import {
  getOrCreateGlobalRotation,
  resetGlobalRotationCache,
} from './rewards.global-rotation';

describe('rewards global rotation', () => {
  beforeEach(() => {
    resetGlobalRotationCache();
  });

  it('returns the same persisted rotation for repeated calls in a cycle', async () => {
    const periodStart = new Date('2026-11-18T00:00:00.000Z');
    const periodEnd = new Date('2026-11-19T00:00:00.000Z');
    const stored = {
      id: 'rot-1',
      cycleKey: 'D:2026-11-18',
      period: 'DAILY' as const,
      periodStart,
      periodEnd,
      missionIds: ['m1', 'm2', 'm3'],
      createdAt: new Date(),
    };
    const prisma = {
      rewardGlobalRotation: {
        findUnique: jest.fn().mockResolvedValue(stored),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      rewardMission: { findMany: jest.fn() },
    };

    const first = await getOrCreateGlobalRotation(
      prisma,
      'DAILY',
      periodStart,
      periodEnd,
    );
    const second = await getOrCreateGlobalRotation(
      prisma,
      'DAILY',
      periodStart,
      periodEnd,
    );
    expect(first.missionIds).toEqual(['m1', 'm2', 'm3']);
    expect(second).toEqual(first);
    expect(prisma.rewardGlobalRotation.create).not.toHaveBeenCalled();
    // Second call served from process cache.
    expect(prisma.rewardGlobalRotation.findUnique).toHaveBeenCalledTimes(1);
  });

  it('creates once and recovers from concurrent P2002', async () => {
    const periodStart = new Date('2026-11-18T00:00:00.000Z');
    const periodEnd = new Date('2026-11-19T00:00:00.000Z');
    const raced = {
      id: 'rot-winner',
      cycleKey: 'D:2026-11-18',
      period: 'DAILY' as const,
      periodStart,
      periodEnd,
      missionIds: ['a', 'b', 'c'],
      createdAt: new Date(),
    };
    const prisma = {
      rewardGlobalRotation: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(raced),
        findMany: jest.fn(),
        create: jest.fn().mockRejectedValue({ code: 'P2002' }),
      },
      rewardMission: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'a',
            period: 'DAILY',
            catalogKey: 'TRIBUTE_TO_GODS',
            pillar: 'SYSTEM',
            role: 'FIXED_ADS',
            eventType: 'WATCH_AD',
            active: true,
            eventImplemented: false,
          },
          {
            id: 'b',
            period: 'DAILY',
            catalogKey: 'TAVERN_VOICE',
            pillar: 'COMMUNITY',
            role: 'POOL',
            eventType: 'FORUM_COMMENT_CREATED',
            active: true,
            eventImplemented: true,
          },
          {
            id: 'c',
            period: 'DAILY',
            catalogKey: 'BESTIARY_SCHOLAR',
            pillar: 'BESTIARY',
            role: 'POOL',
            eventType: 'CREATURE_VIEWED',
            active: true,
            eventImplemented: true,
          },
        ]),
      },
    };

    const row = await getOrCreateGlobalRotation(
      prisma,
      'DAILY',
      periodStart,
      periodEnd,
    );
    expect(row.id).toBe('rot-winner');
    expect(row.missionIds).toEqual(['a', 'b', 'c']);
  });

  it('selects a stable global set when creating a new cycle', async () => {
    const periodStart = new Date('2026-11-18T00:00:00.000Z');
    const periodEnd = new Date('2026-11-19T00:00:00.000Z');
    const createdPayload: { missionIds?: string[] } = {};
    const prisma = {
      rewardGlobalRotation: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => {
          Object.assign(createdPayload, data);
          return Promise.resolve({ ...data, createdAt: new Date() });
        }),
      },
      rewardMission: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'ads',
            period: 'DAILY',
            catalogKey: 'TRIBUTE_TO_GODS',
            pillar: 'SYSTEM',
            role: 'FIXED_ADS',
            eventType: 'WATCH_AD',
            active: true,
            eventImplemented: false,
          },
          {
            id: 'pool-1',
            period: 'DAILY',
            catalogKey: 'TAVERN_VOICE',
            pillar: 'COMMUNITY',
            role: 'POOL',
            eventType: 'FORUM_COMMENT_CREATED',
            active: true,
            eventImplemented: true,
          },
          {
            id: 'pool-2',
            period: 'DAILY',
            catalogKey: 'LAND_EXPLORER',
            pillar: 'TOOLS',
            role: 'POOL',
            eventType: 'HUNT_VIEWED',
            active: true,
            eventImplemented: true,
          },
        ]),
      },
    };

    const row = await getOrCreateGlobalRotation(
      prisma,
      'DAILY',
      periodStart,
      periodEnd,
    );
    expect(row.missionIds[0]).toBe('ads');
    expect(row.missionIds).toHaveLength(3);
    expect(new Set(row.missionIds).size).toBe(3);
  });
});
