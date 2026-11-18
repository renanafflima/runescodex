import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RewardConversionKind } from './dto/convert-rewards.dto';
import { RewardsService } from './rewards.service';
import { currentPeriodWindow } from './rewards.periods';

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const USER_A = 'user-a';
const USER_B = 'user-b';
const MISSION_ID = '11111111-1111-4111-8111-111111111111';
const ITEM_GOLD_ID = '22222222-2222-4222-8222-222222222222';
const ITEM_DIAMOND_ID = '33333333-3333-4333-8333-333333333333';
const WALLET_ID = 'wallet-a';

function walletRow(overrides = {}) {
  return {
    id: WALLET_ID,
    userId: USER_A,
    points: 0,
    gold: 0,
    diamond: 0,
    updatedAt: new Date('2026-09-21T00:00:00.000Z'),
    ...overrides,
  };
}

function missionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: MISSION_ID,
    title: 'Poste no Fórum',
    description: 'Crie um tópico útil no fórum da comunidade.',
    category: 'COMMUNITY',
    period: 'DAILY',
    target: 2,
    pointsReward: 30,
    imageKey: 'missionForum',
    eventType: 'FORUM_TOPIC_CREATED',
    catalogKey: 'KINGDOM_SCRIBE',
    pillar: 'COMMUNITY',
    role: 'POOL',
    eventImplemented: true,
    active: true,
    createdAt: new Date('2026-09-21T00:00:00.000Z'),
    updatedAt: new Date('2026-09-21T00:00:00.000Z'),
    ...overrides,
  };
}

function progressRow(overrides = {}) {
  return {
    id: 'progress-1',
    userId: USER_A,
    missionId: MISSION_ID,
    progress: 0,
    completed: false,
    completedAt: null,
    periodStart: new Date('2026-09-21T00:00:00.000Z'),
    periodEnd: new Date('2026-09-22T00:00:00.000Z'),
    createdAt: new Date('2026-09-21T00:00:00.000Z'),
    updatedAt: new Date('2026-09-21T00:00:00.000Z'),
    ...overrides,
  };
}

function catalogItem(overrides = {}) {
  return {
    id: ITEM_GOLD_ID,
    name: '125 Tibia Coins',
    description: 'Recompensa digital para sua conta.',
    imageKey: 'tc125',
    currency: 'GOLD',
    price: 5,
    active: true,
    sortOrder: 1,
    createdAt: new Date('2026-09-21T00:00:00.000Z'),
    updatedAt: new Date('2026-09-21T00:00:00.000Z'),
    ...overrides,
  };
}

describe('RewardsService', () => {
  let service: RewardsService;
  const prisma = {
    $transaction: jest.fn(),
    rewardWallet: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    rewardMission: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    userMissionProgress: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    rewardCatalogItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    rewardRedemption: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    rewardRedemptionStatusEvent: {
      create: jest.fn(),
    },
    rewardLedgerEntry: {
      create: jest.fn(),
    },
    rewardEventReceipt: {
      createMany: jest.fn(),
    },
    userRewardCycleCompletion: {
      createMany: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };

  function matchesImplemented(
    mission: { eventImplemented?: boolean },
    where?: Record<string, unknown>,
  ) {
    if (where?.eventImplemented === true) {
      return mission.eventImplemented === true;
    }
    return true;
  }

  function installMissionCatalog(
    catalog = [missionRow()],
    options?: { listMissionsCatalog?: typeof catalog },
  ) {
    const listCatalog = options?.listMissionsCatalog ?? catalog;
    prisma.rewardMission.findMany.mockImplementation(
      ({ where }: { where?: Record<string, unknown> }) => {
        if (where?.eventType) {
          return Promise.resolve(
            catalog.filter(
              (mission) =>
                mission.active &&
                mission.eventType === where.eventType &&
                matchesImplemented(mission, where),
            ),
          );
        }
        if (where?.period === 'DAILY' && where?.active === true) {
          return Promise.resolve(
            catalog.filter(
              (mission) => mission.active && mission.period === 'DAILY',
            ),
          );
        }
        if (where?.active === true && where?.period) {
          return Promise.resolve(
            listCatalog.filter(
              (mission) =>
                mission.active && mission.period === where.period,
            ),
          );
        }
        if (where?.active === true) {
          return Promise.resolve(catalog.filter((mission) => mission.active));
        }
        return Promise.resolve(catalog);
      },
    );
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.userMissionProgress.updateMany.mockResolvedValue({ count: 1 });
    prisma.userMissionProgress.findUniqueOrThrow.mockResolvedValue(
      progressRow({ progress: 1 }),
    );
    prisma.userRewardCycleCompletion.createMany.mockResolvedValue({ count: 0 });
    prisma.userRewardCycleCompletion.count.mockResolvedValue(0);
    // Catalog already present — skip ensure upserts in unit tests.
    prisma.rewardMission.count.mockResolvedValue(3);
    installMissionCatalog();

    const moduleRef = await Test.createTestingModule({
      providers: [RewardsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(RewardsService);
  });

  it('creates a wallet for the authenticated user', async () => {
    prisma.rewardWallet.findUnique.mockResolvedValue(null);
    prisma.rewardWallet.createMany.mockResolvedValue({ count: 1 });
    prisma.rewardWallet.findUniqueOrThrow.mockResolvedValue(walletRow());
    prisma.rewardMission.findMany.mockResolvedValue([]);
    prisma.userMissionProgress.findMany.mockResolvedValue([]);

    const result = await service.getMe(USER_A);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.rewardWallet.createMany).toHaveBeenCalledWith({
      data: [{ userId: USER_A }],
      skipDuplicates: true,
    });
    expect(result.wallet).toEqual({ points: 0, gold: 0, diamond: 0 });
  });

  it('reads an existing wallet without opening a transaction', async () => {
    prisma.rewardWallet.findUnique.mockResolvedValue(
      walletRow({ points: 12, gold: 1, diamond: 2 }),
    );
    prisma.rewardMission.findMany.mockResolvedValue([]);
    prisma.userMissionProgress.findMany.mockResolvedValue([]);

    const result = await service.getMe(USER_A);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result).toEqual({
      wallet: { points: 12, gold: 1, diamond: 2 },
      missions: {
        DAILY: { total: 0, completed: 0 },
        WEEKLY: { total: 0, completed: 0 },
        MONTHLY: { total: 0, completed: 0 },
      },
      conversions: {
        pointsToGold: [
          { amount: 1, pointsCost: 10_000, goldGranted: 1, enabled: true },
          { amount: 5, pointsCost: 45_000, goldGranted: 5, enabled: true },
        ],
        goldToDiamond: { enabled: false, rate: null },
      },
    });
  });

  it('keeps the current period summary when older progress exists', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-21T15:00:00.000Z'));
    try {
      const now = new Date();
      const daily = currentPeriodWindow('DAILY', now).periodStart;
      const weekly = currentPeriodWindow('WEEKLY', now).periodStart;
      const monthly = currentPeriodWindow('MONTHLY', now).periodStart;
      const previousDay = new Date('2026-09-20T00:00:00.000Z');
      prisma.rewardWallet.findUnique.mockResolvedValue(walletRow());
      installMissionCatalog([
        missionRow({
          id: 'daily-mission',
          period: 'DAILY',
          catalogKey: 'KINGDOM_SCRIBE',
          pillar: 'COMMUNITY',
          eventType: 'FORUM_TOPIC_CREATED',
        }),
        missionRow({
          id: 'weekly-mission',
          period: 'WEEKLY',
          catalogKey: 'KINGDOM_SCRIBE',
          pillar: 'COMMUNITY',
          eventType: 'FORUM_TOPIC_CREATED',
        }),
        missionRow({
          id: 'monthly-mission',
          period: 'MONTHLY',
          catalogKey: 'KINGDOM_SCRIBE',
          pillar: 'COMMUNITY',
          eventType: 'FORUM_TOPIC_CREATED',
        }),
      ]);
      prisma.userMissionProgress.findMany.mockResolvedValue([
        progressRow({
          missionId: 'daily-mission',
          completed: true,
          periodStart: daily,
        }),
        progressRow({
          missionId: 'weekly-mission',
          completed: true,
          periodStart: weekly,
        }),
        progressRow({
          missionId: 'monthly-mission',
          completed: false,
          periodStart: monthly,
        }),
      ]);

      const result = await service.getMe(USER_A);

      const progressCall =
        prisma.userMissionProgress.findMany.mock.calls[0][0];
      expect(progressCall.where.userId).toBe(USER_A);
      expect(progressCall.where.missionId.in).toEqual(
        expect.arrayContaining([
          'daily-mission',
          'weekly-mission',
          'monthly-mission',
        ]),
      );
      const starts = progressCall.where.periodStart.in;
      expect(
        starts.some((start: Date) => start.getTime() === previousDay.getTime()),
      ).toBe(false);
      expect(result.missions).toEqual({
        DAILY: { total: 1, completed: 1 },
        WEEKLY: { total: 1, completed: 1 },
        MONTHLY: { total: 1, completed: 0 },
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('creates a single wallet when two first reads arrive together', async () => {
    const state = { wallets: 0, transactions: 0 };
    const local = {
      $transaction: async (fn: (tx: typeof local) => Promise<unknown>) => {
        state.transactions += 1;
        return fn(local);
      },
      rewardWallet: {
        findUnique: async () => (state.wallets ? walletRow() : null),
        createMany: async () => {
          if (state.wallets) return { count: 0 };
          state.wallets = 1;
          return { count: 1 };
        },
        findUniqueOrThrow: async () => walletRow(),
      },
      rewardMission: {
        findMany: async () => [],
        count: async () => 3,
      },
      userMissionProgress: { findMany: async () => [] },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [RewardsService, { provide: PrismaService, useValue: local }],
    }).compile();
    const localService = moduleRef.get(RewardsService);

    const [first, second] = await Promise.all([
      localService.getMe(USER_A),
      localService.getMe(USER_A),
    ]);

    expect(state.wallets).toBe(1);
    expect(state.transactions).toBe(2);
    expect(first.wallet).toEqual({ points: 0, gold: 0, diamond: 0 });
    expect(second.wallet).toEqual(first.wallet);
  });

  it('lists only active missions for the requested period with user progress', async () => {
    installMissionCatalog();
    prisma.userMissionProgress.findMany.mockResolvedValue([
      progressRow({ progress: 1 }),
    ]);

    const result = await service.listMissions(USER_A, { period: 'DAILY' });

    expect(prisma.rewardMission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { active: true, period: 'DAILY' },
      }),
    );
    expect(result[0].current).toBe(1);
    expect(result[0].completed).toBe(false);
    expect(result[0].rewardPoints).toBe(30);
  });

  it('ensures catalog v2 when rotation rows are missing after migration', async () => {
    const created: Array<{ catalogKey: string; period: string; role: string }> =
      [];
    prisma.rewardMission.count.mockResolvedValue(0);
    prisma.rewardMission.findFirst.mockResolvedValue(null);
    prisma.rewardMission.create.mockImplementation(
      ({ data }: { data: { catalogKey: string; period: string; role: string } }) => {
        created.push({
          catalogKey: data.catalogKey,
          period: data.period,
          role: data.role,
        });
        return Promise.resolve({ id: `${data.catalogKey}-${data.period}` });
      },
    );
    prisma.rewardMission.updateMany.mockResolvedValue({ count: 2 });

    // After ensure, listMissions reloads active DAILY rows — serve created catalog.
    prisma.rewardMission.findMany.mockImplementation(
      ({ where }: { where?: Record<string, unknown> }) => {
        const rows = created
          .filter((row) => !where?.period || row.period === where.period)
          .map((row, index) =>
            missionRow({
              id: `ensured-${index}`,
              catalogKey: row.catalogKey,
              period: row.period,
              role: row.role,
              eventType:
                row.role === 'FIXED_ADS'
                  ? 'WATCH_AD'
                  : row.role === 'FIXED_WEEKLY_STREAK'
                    ? 'DAILY_ALL_COMPLETED'
                    : row.role === 'FIXED_MONTHLY_STREAK'
                      ? 'WEEKLY_ALL_COMPLETED'
                      : 'FORUM_TOPIC_CREATED',
              eventImplemented: row.role !== 'FIXED_ADS',
              pillar: row.role === 'FIXED_ADS' ? 'SYSTEM' : `P${index}`,
            }),
          );
        return Promise.resolve(rows);
      },
    );
    prisma.userMissionProgress.findMany.mockResolvedValue([]);

    const result = await service.listMissions(USER_A, { period: 'DAILY' });
    expect(prisma.rewardMission.create).toHaveBeenCalled();
    expect(created.some((row) => row.catalogKey === 'TRIBUTE_TO_GODS')).toBe(
      true,
    );
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((mission) => mission.role === 'FIXED_ADS')).toBe(true);
  });

  it('lists three daily featured missions: FIXED_ADS + two pool', async () => {
    const day = new Date('2026-11-15T12:00:00.000Z');
    const catalog = [
      missionRow({
        id: 'daily-ads',
        title: 'Tributo aos Deuses',
        eventType: 'WATCH_AD',
        category: 'PROMOTION',
        catalogKey: 'TRIBUTE_TO_GODS',
        pillar: 'PROMOTION',
        role: 'FIXED_ADS',
        eventImplemented: false,
        target: 3,
        pointsReward: 120,
      }),
      missionRow({
        id: 'daily-forum-topic',
        eventType: 'FORUM_TOPIC_CREATED',
        catalogKey: 'KINGDOM_SCRIBE',
        pillar: 'COMMUNITY',
      }),
      missionRow({
        id: 'daily-forum-comment',
        title: 'Faça 3 comentários',
        eventType: 'FORUM_COMMENT_CREATED',
        catalogKey: 'TAVERN_VOICE',
        pillar: 'COMMUNITY',
        target: 3,
      }),
      missionRow({
        id: 'daily-bosstiary',
        title: 'Compartilhe uma rotação',
        eventType: 'BOSSTIARY_COMMUNITY_ROTATION_PUBLISHED',
        catalogKey: 'ROTATION_STRATEGIST',
        pillar: 'BOSSES',
        target: 1,
        pointsReward: 35,
      }),
      missionRow({
        id: 'daily-creature',
        title: 'Estudioso',
        eventType: 'CREATURE_VIEWED',
        catalogKey: 'BESTIARY_SCHOLAR',
        pillar: 'BESTIARY',
        target: 5,
      }),
    ];
    installMissionCatalog(catalog, { listMissionsCatalog: catalog });
    prisma.userMissionProgress.findMany.mockResolvedValue([]);

    jest.useFakeTimers().setSystemTime(day);
    const result = await service.listMissions(USER_A, { period: 'DAILY' });
    jest.useRealTimers();

    expect(result).toHaveLength(3);
    expect(result.map((mission) => mission.id)).toContain('daily-ads');
    expect(result.filter((mission) => mission.role === 'POOL')).toHaveLength(2);
    expect(result.every((mission) => mission.period === 'DAILY')).toBe(true);
  });

  it('increments an active mission from a valid event', async () => {
    installMissionCatalog();
    prisma.rewardEventReceipt.createMany.mockResolvedValue({ count: 1 });
    prisma.rewardWallet.findUnique.mockResolvedValue(walletRow());
    prisma.userMissionProgress.findUnique.mockResolvedValue(progressRow());
    prisma.userMissionProgress.update.mockResolvedValue(
      progressRow({ progress: 1 }),
    );

    const result = await service.recordEvent(
      USER_A,
      'FORUM_TOPIC_CREATED',
      { referenceType: 'ForumThread', referenceId: 'thread-1' },
      new Date('2026-09-21T12:00:00.000Z'),
    );

    expect(result.applied[0].current).toBe(1);
    expect(result.applied[0].completed).toBe(false);
    expect(prisma.rewardLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('completes a mission and credits points once', async () => {
    installMissionCatalog([missionRow()]);
    prisma.rewardEventReceipt.createMany.mockResolvedValue({ count: 1 });
    prisma.rewardWallet.findUnique.mockResolvedValue(walletRow());
    prisma.userMissionProgress.findUnique.mockResolvedValue(
      progressRow({ progress: 1 }),
    );
    prisma.userMissionProgress.findUniqueOrThrow.mockResolvedValue(
      progressRow({ progress: 2 }),
    );
    prisma.userMissionProgress.updateMany.mockResolvedValue({ count: 1 });
    prisma.rewardWallet.update.mockResolvedValue(walletRow({ points: 30 }));
    prisma.rewardLedgerEntry.create.mockResolvedValue({});

    const result = await service.recordEvent(
      USER_A,
      'FORUM_TOPIC_CREATED',
      { referenceType: 'ForumThread', referenceId: 'thread-2' },
      new Date('2026-09-21T12:00:00.000Z'),
    );

    expect(result.applied[0]).toMatchObject({
      completed: true,
      wallet: { points: 30 },
    });
    expect(prisma.rewardLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'MISSION_REWARD',
          pointsDelta: 30,
          userId: USER_A,
        }),
      }),
    );
  });

  it('does not duplicate a repeated event reference', async () => {
    installMissionCatalog([missionRow()]);
    prisma.rewardEventReceipt.createMany.mockResolvedValue({ count: 0 });

    const result = await service.recordEvent(USER_A, 'FORUM_TOPIC_CREATED', {
      referenceType: 'ForumThread',
      referenceId: 'thread-1',
    });

    expect(result.applied).toEqual([]);
    expect(prisma.userMissionProgress.updateMany).not.toHaveBeenCalled();
    expect(prisma.rewardLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('does not progress an inactive mission', async () => {
    prisma.rewardMission.findMany.mockResolvedValue([]);

    const result = await service.recordEvent(USER_A, 'FORUM_TOPIC_CREATED', {
      referenceType: 'ForumThread',
      referenceId: 'thread-3',
    });

    expect(prisma.rewardMission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          active: true,
          eventType: 'FORUM_TOPIC_CREATED',
        },
      }),
    );
    expect(result.applied).toEqual([]);
  });

  it('scopes event progress to the authenticated user', async () => {
    installMissionCatalog([missionRow()]);
    prisma.rewardEventReceipt.createMany.mockResolvedValue({ count: 1 });
    prisma.rewardWallet.findUnique.mockResolvedValue(walletRow());
    prisma.userMissionProgress.findUnique.mockResolvedValue(progressRow());
    prisma.userMissionProgress.update.mockResolvedValue(
      progressRow({ progress: 1 }),
    );

    await service.recordEvent(USER_A, 'FORUM_TOPIC_CREATED', {
      referenceType: 'ForumThread',
      referenceId: 'thread-4',
    });

    expect(prisma.rewardEventReceipt.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ userId: USER_A })],
        skipDuplicates: true,
      }),
    );
    expect(
      JSON.stringify(prisma.rewardEventReceipt.createMany.mock.calls),
    ).not.toContain(USER_B);
  });

  it('rejects an invalid event type', async () => {
    await expect(
      service.recordEvent(USER_A, 'NOT_A_REAL_EVENT', {
        referenceType: 'X',
        referenceId: '1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts WATCH_AD and queries active WATCH_AD missions', async () => {
    installMissionCatalog([
      missionRow({
        eventType: 'WATCH_AD',
        title: 'Assistir anúncios',
        target: 3,
        catalogKey: 'TRIBUTE_TO_GODS',
        pillar: 'PROMOTION',
        role: 'FIXED_ADS',
        eventImplemented: true,
      }),
    ]);
    prisma.rewardEventReceipt.createMany.mockResolvedValue({ count: 1 });
    prisma.rewardWallet.findUnique.mockResolvedValue(walletRow());
    prisma.userMissionProgress.findUnique.mockResolvedValue(progressRow());
    prisma.userMissionProgress.update.mockResolvedValue(
      progressRow({ progress: 1 }),
    );

    await service.recordEvent(USER_A, 'WATCH_AD', {
      referenceType: 'AdMobSsvTransaction',
      referenceId: 'admob-tx-1',
    });

    expect(prisma.rewardMission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          active: true,
          eventType: 'WATCH_AD',
        },
      }),
    );
  });

  it('allows a DAILY mission again on the next UTC day', async () => {
    installMissionCatalog([missionRow()]);
    prisma.rewardEventReceipt.createMany.mockResolvedValue({ count: 1 });
    prisma.rewardWallet.findUnique.mockResolvedValue(walletRow());
    prisma.userMissionProgress.findUnique.mockResolvedValue(progressRow());
    prisma.userMissionProgress.update.mockResolvedValue(
      progressRow({ progress: 1 }),
    );

    await service.recordEvent(
      USER_A,
      'FORUM_TOPIC_CREATED',
      { referenceType: 'ForumThread', referenceId: 'd1' },
      new Date('2026-09-21T12:00:00.000Z'),
    );
    await service.recordEvent(
      USER_A,
      'FORUM_TOPIC_CREATED',
      { referenceType: 'ForumThread', referenceId: 'd2' },
      new Date('2026-09-22T12:00:00.000Z'),
    );

    const firstStart =
      prisma.rewardEventReceipt.createMany.mock.calls[0][0].data[0].periodStart;
    const secondStart =
      prisma.rewardEventReceipt.createMany.mock.calls[1][0].data[0].periodStart;
    expect(firstStart.toISOString()).toBe('2026-09-21T00:00:00.000Z');
    expect(secondStart.toISOString()).toBe('2026-09-22T00:00:00.000Z');
  });

  it('uses the weekly UTC window for WEEKLY missions', async () => {
    installMissionCatalog([
      missionRow({ period: 'WEEKLY', catalogKey: 'KINGDOM_SCRIBE' }),
    ]);
    prisma.rewardEventReceipt.createMany.mockResolvedValue({ count: 1 });
    prisma.rewardWallet.findUnique.mockResolvedValue(walletRow());
    prisma.userMissionProgress.findUnique.mockResolvedValue(progressRow());
    prisma.userMissionProgress.update.mockResolvedValue(
      progressRow({ progress: 1 }),
    );

    await service.recordEvent(
      USER_A,
      'FORUM_TOPIC_CREATED',
      { referenceType: 'ForumThread', referenceId: 'w1' },
      new Date('2026-09-23T12:00:00.000Z'),
    );

    expect(
      prisma.rewardEventReceipt.createMany.mock.calls[0][0].data[0].periodStart.toISOString(),
    ).toBe('2026-09-21T00:00:00.000Z');
  });

  it('uses the monthly UTC window for MONTHLY missions', async () => {
    installMissionCatalog([
      missionRow({ period: 'MONTHLY', catalogKey: 'KINGDOM_SCRIBE' }),
    ]);
    prisma.rewardEventReceipt.createMany.mockResolvedValue({ count: 1 });
    prisma.rewardWallet.findUnique.mockResolvedValue(walletRow());
    prisma.userMissionProgress.findUnique.mockResolvedValue(progressRow());
    prisma.userMissionProgress.update.mockResolvedValue(
      progressRow({ progress: 1 }),
    );

    await service.recordEvent(
      USER_A,
      'FORUM_TOPIC_CREATED',
      { referenceType: 'ForumThread', referenceId: 'm1' },
      new Date('2026-09-30T12:00:00.000Z'),
    );

    expect(
      prisma.rewardEventReceipt.createMany.mock.calls[0][0].data[0].periodStart.toISOString(),
    ).toBe('2026-09-01T00:00:00.000Z');
  });

  it('converts 10.000 points into 1 Gold', async () => {
    prisma.rewardWallet.findUnique.mockResolvedValue(
      walletRow({ points: 10_000 }),
    );
    prisma.rewardWallet.updateMany.mockResolvedValue({ count: 1 });
    prisma.rewardLedgerEntry.create.mockResolvedValue({});
    prisma.rewardWallet.findUniqueOrThrow.mockResolvedValue(
      walletRow({ points: 0, gold: 1 }),
    );

    const result = await service.convert(USER_A, {
      conversion: RewardConversionKind.POINTS_TO_GOLD,
      amount: 1,
    });

    expect(prisma.rewardWallet.updateMany).toHaveBeenCalledWith({
      where: { id: WALLET_ID, points: { gte: 10_000 } },
      data: {
        points: { decrement: 10_000 },
        gold: { increment: 1 },
      },
    });
    expect(result).toEqual({ points: 0, gold: 1, diamond: 0 });
  });

  it('converts 45.000 points into 5 Gold', async () => {
    prisma.rewardWallet.findUnique.mockResolvedValue(
      walletRow({ points: 45_000 }),
    );
    prisma.rewardWallet.updateMany.mockResolvedValue({ count: 1 });
    prisma.rewardLedgerEntry.create.mockResolvedValue({});
    prisma.rewardWallet.findUniqueOrThrow.mockResolvedValue(
      walletRow({ points: 0, gold: 5 }),
    );

    const result = await service.convert(USER_A, {
      conversion: RewardConversionKind.POINTS_TO_GOLD,
      amount: 5,
    });

    expect(prisma.rewardWallet.updateMany).toHaveBeenCalledWith({
      where: { id: WALLET_ID, points: { gte: 45_000 } },
      data: {
        points: { decrement: 45_000 },
        gold: { increment: 5 },
      },
    });
    expect(result.gold).toBe(5);
  });

  it('rejects conversion without enough points', async () => {
    prisma.rewardWallet.findUnique.mockResolvedValue(
      walletRow({ points: 100 }),
    );
    prisma.rewardWallet.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.convert(USER_A, {
        conversion: RewardConversionKind.POINTS_TO_GOLD,
        amount: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.rewardLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('rejects redemption without enough gold', async () => {
    prisma.rewardCatalogItem.findUnique.mockResolvedValue(catalogItem());
    prisma.rewardWallet.findUnique.mockResolvedValue(walletRow({ gold: 1 }));
    prisma.rewardWallet.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.redeem(USER_A, { catalogItemId: ITEM_GOLD_ID }),
    ).rejects.toMatchObject({ message: 'Insufficient gold' });
    expect(prisma.rewardRedemption.create).not.toHaveBeenCalled();
  });

  it('rejects redemption without enough diamond', async () => {
    prisma.rewardCatalogItem.findUnique.mockResolvedValue(
      catalogItem({
        id: ITEM_DIAMOND_ID,
        name: 'Ferumbras Hat',
        imageKey: 'ferumbrasHat',
        currency: 'DIAMOND',
        price: 3,
      }),
    );
    prisma.rewardWallet.findUnique.mockResolvedValue(walletRow({ diamond: 0 }));
    prisma.rewardWallet.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.redeem(USER_A, { catalogItemId: ITEM_DIAMOND_ID }),
    ).rejects.toMatchObject({ message: 'Insufficient diamond' });
  });

  it('redeems an active priced item and creates a pending redemption', async () => {
    prisma.rewardCatalogItem.findUnique.mockResolvedValue(catalogItem());
    prisma.rewardWallet.findUnique.mockResolvedValue(walletRow({ gold: 5 }));
    prisma.rewardWallet.updateMany.mockResolvedValue({ count: 1 });
    prisma.rewardRedemption.create.mockResolvedValue({
      id: 'redemption-1',
      catalogItemId: ITEM_GOLD_ID,
      currency: 'GOLD',
      amount: 5,
      quantity: 1,
      status: 'PENDING',
      createdAt: new Date('2026-09-21T00:00:00.000Z'),
      updatedAt: new Date('2026-09-21T00:00:00.000Z'),
      approvedAt: null,
      deliveredAt: null,
      cancelledAt: null,
      catalogItem: { name: '125 Tibia Coins', imageKey: 'tc125' },
    });
    prisma.rewardRedemptionStatusEvent.create.mockResolvedValue({});
    prisma.rewardLedgerEntry.create.mockResolvedValue({});
    prisma.rewardWallet.findUniqueOrThrow.mockResolvedValue(
      walletRow({ gold: 0 }),
    );

    const result = await service.redeem(USER_A, {
      catalogItemId: ITEM_GOLD_ID,
    });

    expect(result.redemption.status).toBe('PENDING');
    expect(result.wallet.gold).toBe(0);
    expect(prisma.rewardLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'REDEMPTION',
          goldDelta: -5,
          userId: USER_A,
        }),
      }),
    );
  });

  it('rejects a concurrent redemption that would reuse the same balance', async () => {
    prisma.rewardCatalogItem.findUnique.mockResolvedValue(catalogItem());
    prisma.rewardWallet.findUnique.mockResolvedValue(walletRow({ gold: 5 }));
    prisma.rewardWallet.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    prisma.rewardRedemption.create.mockResolvedValue({
      id: 'redemption-1',
      catalogItemId: ITEM_GOLD_ID,
      currency: 'GOLD',
      amount: 5,
      quantity: 1,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
      approvedAt: null,
      deliveredAt: null,
      cancelledAt: null,
      catalogItem: { name: '125 Tibia Coins', imageKey: 'tc125' },
    });
    prisma.rewardRedemptionStatusEvent.create.mockResolvedValue({});
    prisma.rewardLedgerEntry.create.mockResolvedValue({});
    prisma.rewardWallet.findUniqueOrThrow.mockResolvedValue(
      walletRow({ gold: 0 }),
    );

    await service.redeem(USER_A, { catalogItemId: ITEM_GOLD_ID });
    await expect(
      service.redeem(USER_A, { catalogItemId: ITEM_GOLD_ID }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.rewardRedemption.create).toHaveBeenCalledTimes(1);
  });

  it('never applies a wallet update when the atomic debit does not match', async () => {
    prisma.rewardWallet.findUnique.mockResolvedValue(walletRow({ points: 0 }));
    prisma.rewardWallet.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.convert(USER_A, {
        conversion: RewardConversionKind.POINTS_TO_GOLD,
        amount: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.rewardWallet.update).not.toHaveBeenCalled();
  });

  it('scopes wallet lookups to the authenticated user', async () => {
    prisma.rewardWallet.findUnique.mockResolvedValue(walletRow());
    prisma.rewardMission.findMany.mockResolvedValue([]);
    prisma.userMissionProgress.findMany.mockResolvedValue([]);

    await service.getMe(USER_A);

    expect(prisma.rewardWallet.findUnique).toHaveBeenCalledWith({
      where: { userId: USER_A },
      select: expect.any(Object),
    });
    expect(
      JSON.stringify(prisma.rewardWallet.findUnique.mock.calls),
    ).not.toContain(USER_B);
  });

  it('lists only the authenticated user redemptions', async () => {
    prisma.rewardRedemption.findMany.mockResolvedValue([]);

    await service.listRedemptions(USER_A);

    expect(prisma.rewardRedemption.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_A },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('rejects Gold to Diamond while the rate is unset', async () => {
    await expect(
      service.convert(USER_A, {
        conversion: RewardConversionKind.GOLD_TO_DIAMOND,
        amount: 1,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.rewardWallet.updateMany).not.toHaveBeenCalled();
  });

  it('rejects redeem when the catalog price is not configured', async () => {
    prisma.rewardCatalogItem.findUnique.mockResolvedValue(
      catalogItem({ price: 0 }),
    );

    await expect(
      service.redeem(USER_A, { catalogItemId: ITEM_GOLD_ID }),
    ).rejects.toMatchObject({ message: 'Reward price is not configured' });
  });

  it('does not credit again when the mission is already completed', async () => {
    installMissionCatalog([missionRow()]);
    prisma.rewardEventReceipt.createMany.mockResolvedValue({ count: 1 });
    prisma.rewardWallet.findUnique.mockResolvedValue(walletRow({ points: 30 }));
    prisma.userMissionProgress.findUnique.mockResolvedValue(
      progressRow({ progress: 2, completed: true, completedAt: new Date() }),
    );

    const result = await service.recordEvent(USER_A, 'FORUM_TOPIC_CREATED', {
      referenceType: 'ForumThread',
      referenceId: 'thread-done',
    });

    expect(result.applied[0].completed).toBe(true);
    expect(prisma.rewardWallet.update).not.toHaveBeenCalled();
    expect(prisma.rewardLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('freezes the catalog price on the redemption even if the catalog later changes', async () => {
    prisma.rewardCatalogItem.findUnique.mockResolvedValue(
      catalogItem({ price: 5 }),
    );
    prisma.rewardWallet.findUnique.mockResolvedValue(walletRow({ gold: 5 }));
    prisma.rewardWallet.updateMany.mockResolvedValue({ count: 1 });
    prisma.rewardRedemption.create.mockResolvedValue({
      id: 'redemption-1',
      catalogItemId: ITEM_GOLD_ID,
      currency: 'GOLD',
      amount: 5,
      quantity: 1,
      status: 'PENDING',
      createdAt: new Date('2026-09-21T00:00:00.000Z'),
      updatedAt: new Date('2026-09-21T00:00:00.000Z'),
      deliveredAt: null,
      catalogItem: { name: '125 Tibia Coins', imageKey: 'tc125' },
    });
    prisma.rewardRedemptionStatusEvent.create.mockResolvedValue({});
    prisma.rewardLedgerEntry.create.mockResolvedValue({});
    prisma.rewardWallet.findUniqueOrThrow.mockResolvedValue(
      walletRow({ gold: 0 }),
    );

    const result = await service.redeem(USER_A, {
      catalogItemId: ITEM_GOLD_ID,
    });
    expect(result.redemption.price).toBe(5);
    expect(prisma.rewardRedemption.create.mock.calls[0][0].data.amount).toBe(5);
  });

  it('does not expose another user redemption on the common route', async () => {
    prisma.rewardRedemption.findFirst.mockResolvedValue(null);

    await expect(
      service.getRedemption(USER_A, ITEM_GOLD_ID),
    ).rejects.toMatchObject({ message: 'Redemption not found' });
    expect(prisma.rewardRedemption.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ITEM_GOLD_ID, userId: USER_A },
      }),
    );
  });

  it('aborts the transaction when ledger create fails after debit', async () => {
    prisma.rewardCatalogItem.findUnique.mockResolvedValue(catalogItem());
    prisma.rewardWallet.findUnique.mockResolvedValue(walletRow({ gold: 5 }));
    prisma.rewardWallet.updateMany.mockResolvedValue({ count: 1 });
    prisma.rewardRedemption.create.mockResolvedValue({
      id: 'redemption-1',
      catalogItemId: ITEM_GOLD_ID,
      currency: 'GOLD',
      amount: 5,
      quantity: 1,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
      deliveredAt: null,
      catalogItem: { name: '125 Tibia Coins', imageKey: 'tc125' },
    });
    prisma.rewardRedemptionStatusEvent.create.mockResolvedValue({});
    prisma.rewardLedgerEntry.create.mockRejectedValue(new Error('ledger fail'));

    await expect(
      service.redeem(USER_A, { catalogItemId: ITEM_GOLD_ID }),
    ).rejects.toThrow('ledger fail');
  });

  it('does not expose admin status transitions on the user service', () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        Object.getPrototypeOf(service),
        'approve',
      ),
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(
        Object.getPrototypeOf(service),
        'deliver',
      ),
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(
        Object.getPrototypeOf(service),
        'cancel',
      ),
    ).toBe(false);
  });
});

describe('currentPeriodWindow', () => {
  it('builds a UTC daily window that resets the next day', () => {
    const now = new Date('2026-09-21T15:04:00.000Z');
    const window = currentPeriodWindow('DAILY', now);
    expect(window.periodStart.toISOString()).toBe('2026-09-21T00:00:00.000Z');
    expect(window.periodEnd.toISOString()).toBe('2026-09-22T00:00:00.000Z');
  });
});
