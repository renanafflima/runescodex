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

function missionRow(overrides = {}) {
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
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    rewardMission: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    userMissionProgress: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
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
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((fn) => fn(prisma));

    const moduleRef = await Test.createTestingModule({
      providers: [RewardsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(RewardsService);
  });

  it('creates a wallet for the authenticated user', async () => {
    prisma.rewardWallet.findUnique.mockResolvedValue(null);
    prisma.rewardWallet.create.mockResolvedValue(walletRow());
    prisma.rewardMission.findMany.mockResolvedValue([]);
    prisma.userMissionProgress.findMany.mockResolvedValue([]);

    const result = await service.getMe(USER_A);

    expect(prisma.rewardWallet.create).toHaveBeenCalledWith({
      data: { userId: USER_A },
      select: expect.any(Object),
    });
    expect(result.wallet).toEqual({ points: 0, gold: 0, diamond: 0 });
  });

  it('lists only active missions for the requested period with user progress', async () => {
    prisma.rewardMission.findMany.mockResolvedValue([missionRow()]);
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

  it('increments an active mission from a valid event', async () => {
    prisma.rewardMission.findMany.mockResolvedValue([missionRow()]);
    prisma.rewardEventReceipt.create.mockResolvedValue({});
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
    prisma.rewardMission.findMany.mockResolvedValue([missionRow()]);
    prisma.rewardEventReceipt.create.mockResolvedValue({});
    prisma.rewardWallet.findUnique.mockResolvedValue(walletRow());
    prisma.userMissionProgress.findUnique.mockResolvedValue(
      progressRow({ progress: 1 }),
    );
    prisma.userMissionProgress.update.mockResolvedValue({});
    prisma.userMissionProgress.updateMany.mockResolvedValue({ count: 1 });
    prisma.rewardWallet.update.mockResolvedValue(walletRow({ points: 30 }));
    prisma.rewardLedgerEntry.create.mockResolvedValue({});

    const result = await service.recordEvent(
      USER_A,
      'FORUM_TOPIC_CREATED',
      { referenceType: 'ForumThread', referenceId: 'thread-2' },
      new Date('2026-09-21T12:00:00.000Z'),
    );

    expect(result.applied[0].completed).toBe(true);
    expect(result.applied[0].wallet.points).toBe(30);
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
    prisma.rewardMission.findMany.mockResolvedValue([missionRow()]);
    prisma.rewardEventReceipt.create.mockRejectedValue({ code: 'P2002' });

    const result = await service.recordEvent(USER_A, 'FORUM_TOPIC_CREATED', {
      referenceType: 'ForumThread',
      referenceId: 'thread-1',
    });

    expect(result.applied).toEqual([]);
    expect(prisma.userMissionProgress.update).not.toHaveBeenCalled();
    expect(prisma.rewardLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('does not progress an inactive mission', async () => {
    prisma.rewardMission.findMany.mockResolvedValue([]);

    const result = await service.recordEvent(USER_A, 'FORUM_TOPIC_CREATED', {
      referenceType: 'ForumThread',
      referenceId: 'thread-3',
    });

    expect(prisma.rewardMission.findMany).toHaveBeenCalledWith({
      where: { active: true, eventType: 'FORUM_TOPIC_CREATED' },
    });
    expect(result.applied).toEqual([]);
  });

  it('scopes event progress to the authenticated user', async () => {
    prisma.rewardMission.findMany.mockResolvedValue([missionRow()]);
    prisma.rewardEventReceipt.create.mockResolvedValue({});
    prisma.rewardWallet.findUnique.mockResolvedValue(walletRow());
    prisma.userMissionProgress.findUnique.mockResolvedValue(progressRow());
    prisma.userMissionProgress.update.mockResolvedValue(
      progressRow({ progress: 1 }),
    );

    await service.recordEvent(USER_A, 'FORUM_TOPIC_CREATED', {
      referenceType: 'ForumThread',
      referenceId: 'thread-4',
    });

    expect(prisma.rewardEventReceipt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: USER_A }),
      }),
    );
    expect(
      JSON.stringify(prisma.rewardEventReceipt.create.mock.calls),
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

  it('allows a DAILY mission again on the next UTC day', async () => {
    prisma.rewardMission.findMany.mockResolvedValue([missionRow()]);
    prisma.rewardEventReceipt.create.mockResolvedValue({});
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
      prisma.rewardEventReceipt.create.mock.calls[0][0].data.periodStart;
    const secondStart =
      prisma.rewardEventReceipt.create.mock.calls[1][0].data.periodStart;
    expect(firstStart.toISOString()).toBe('2026-09-21T00:00:00.000Z');
    expect(secondStart.toISOString()).toBe('2026-09-22T00:00:00.000Z');
  });

  it('uses the weekly UTC window for WEEKLY missions', async () => {
    prisma.rewardMission.findMany.mockResolvedValue([
      missionRow({ period: 'WEEKLY' }),
    ]);
    prisma.rewardEventReceipt.create.mockResolvedValue({});
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
      prisma.rewardEventReceipt.create.mock.calls[0][0].data.periodStart.toISOString(),
    ).toBe('2026-09-21T00:00:00.000Z');
  });

  it('uses the monthly UTC window for MONTHLY missions', async () => {
    prisma.rewardMission.findMany.mockResolvedValue([
      missionRow({ period: 'MONTHLY' }),
    ]);
    prisma.rewardEventReceipt.create.mockResolvedValue({});
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
      prisma.rewardEventReceipt.create.mock.calls[0][0].data.periodStart.toISOString(),
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
    prisma.rewardMission.findMany.mockResolvedValue([missionRow()]);
    prisma.rewardEventReceipt.create.mockResolvedValue({});
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
