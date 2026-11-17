import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import {
  CLIENT_TRACKABLE_EVENTS,
  GOLD_TO_DIAMOND_RATE,
  POINTS_TO_GOLD_PACKAGES,
  REWARD_EVENTS,
  UNCONFIGURED_PRICE,
  isSupportedRewardEvent,
  type MissionPeriod,
  type PointsToGoldAmount,
  type RewardCurrencyCode,
} from './rewards.constants';
import {
  selectFeaturedForPeriod,
  type RotationMissionPick,
} from './rewards.rotation';
import {
  ConvertRewardsDto,
  RewardConversionKind,
} from './dto/convert-rewards.dto';
import { ListMissionsQueryDto } from './dto/list-missions-query.dto';
import { RedeemRewardDto } from './dto/redeem-reward.dto';
import { TrackRewardActivityDto } from './dto/track-reward-activity.dto';
import { currentPeriodWindow } from './rewards.periods';
import { userRedemptionMessage } from './rewards.redemption';

const MISSION_SELECT = {
  id: true,
  title: true,
  description: true,
  category: true,
  period: true,
  target: true,
  pointsReward: true,
  imageKey: true,
  eventType: true,
  catalogKey: true,
  pillar: true,
  role: true,
  eventImplemented: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

const WALLET_SELECT = {
  id: true,
  userId: true,
  points: true,
  gold: true,
  diamond: true,
  updatedAt: true,
} as const;

@Injectable()
export class RewardsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const wallet = await this.readWallet(userId);
    const now = new Date();
    const periodStarts = (['DAILY', 'WEEKLY', 'MONTHLY'] as const).map(
      (period) => currentPeriodWindow(period, now).periodStart,
    );

    const missions = await this.prisma.rewardMission.findMany({
      where: { active: true },
      select: MISSION_SELECT,
    });

    const featuredIds = this.featuredIdsForAllPeriods(missions, now);
    const progressRows = await this.prisma.userMissionProgress.findMany({
      where: {
        userId,
        missionId: { in: [...featuredIds] },
        periodStart: { in: periodStarts },
      },
    });

    const summary = this.summarizeMissions(
      missions,
      progressRows,
      now,
      featuredIds,
    );

    return {
      wallet: this.serializeWallet(wallet),
      missions: summary,
      conversions: this.serializeConversions(),
    };
  }

  async listMissions(userId: string, query: ListMissionsQueryDto) {
    const { periodStart, periodEnd } = currentPeriodWindow(query.period);
    const missions = await this.prisma.rewardMission.findMany({
      where: { active: true, period: query.period },
      select: MISSION_SELECT,
      orderBy: { createdAt: 'asc' },
    });

    const visibleMissions = this.filterFeaturedMissions(
      missions,
      query.period,
      periodStart,
    );

    const progressRows = await this.prisma.userMissionProgress.findMany({
      where: {
        userId,
        periodStart,
        missionId: { in: visibleMissions.map((mission) => mission.id) },
      },
    });
    const progressByMission = new Map(
      progressRows.map((row) => [row.missionId, row]),
    );

    const cycleExtra =
      query.period === 'WEEKLY' || query.period === 'MONTHLY'
        ? await this.loadCycleProgress(userId, query.period, periodStart)
        : null;

    return visibleMissions.map((mission) =>
      this.serializeMission(
        mission,
        progressByMission.get(mission.id),
        periodStart,
        periodEnd,
        undefined,
        cycleExtra,
      ),
    );
  }

  async trackActivity(userId: string, dto: TrackRewardActivityDto) {
    if (!CLIENT_TRACKABLE_EVENTS.has(dto.eventType)) {
      throw new BadRequestException('Activity type is not trackable');
    }
    if (!dto.referenceId?.trim()) {
      throw new BadRequestException('referenceId is required');
    }
    return this.recordEvent(userId, dto.eventType, {
      referenceType: dto.referenceType?.trim() || 'ClientActivity',
      referenceId: dto.referenceId.trim(),
    });
  }

  async recordEvent(
    userId: string,
    eventType: string,
    metadata: { referenceType: string; referenceId: string },
    at = new Date(),
    db?: Prisma.TransactionClient,
  ) {
    if (!isSupportedRewardEvent(eventType)) {
      throw new BadRequestException('Invalid reward event');
    }
    if (!userId) {
      throw new BadRequestException('Authenticated user is required');
    }
    if (!metadata?.referenceId) {
      throw new BadRequestException('Event reference is required');
    }

    if (db) {
      return this.recordEventWithin(db, userId, eventType, metadata, at, true);
    }

    return this.prisma.$transaction((tx: Prisma.TransactionClient) =>
      this.recordEventWithin(tx, userId, eventType, metadata, at, true),
    );
  }

  private async recordEventWithin(
    tx: Prisma.TransactionClient,
    userId: string,
    eventType: string,
    metadata: { referenceType: string; referenceId: string },
    at: Date,
    runAggregators = true,
  ) {
    const missions = await tx.rewardMission.findMany({
      where: { active: true, eventType, eventImplemented: true },
      select: MISSION_SELECT,
    });

    const featuredByPeriod =
      eventType === REWARD_EVENTS.WATCH_AD
        ? null
        : await this.loadFeaturedIdsByPeriod(tx, at);

    const applied: Awaited<
      ReturnType<RewardsService['applyProgressIncrement']>
    >[] = [];
    for (const mission of missions) {
      if (
        eventType !== REWARD_EVENTS.WATCH_AD &&
        featuredByPeriod &&
        !featuredByPeriod.get(mission.period)?.has(mission.id)
      ) {
        continue;
      }

      const { periodStart, periodEnd } = currentPeriodWindow(
        mission.period,
        at,
      );

      const claimed = await this.claimEventReceipt(tx, {
        userId,
        eventType,
        referenceId: metadata.referenceId,
        missionId: mission.id,
        periodStart,
      });
      if (!claimed) {
        continue;
      }

      applied.push(
        await this.applyProgressIncrement(
          tx,
          userId,
          mission,
          periodStart,
          periodEnd,
        ),
      );
    }

    if (runAggregators) {
      await this.maybeCompleteAggregators(tx, userId, at);
    }

    return { eventType: eventType, applied };
  }

  private async applyProgressIncrement(
    tx: Prisma.TransactionClient,
    userId: string,
    mission: {
      id: string;
      title: string;
      description: string;
      category: string;
      period: MissionPeriod;
      target: number;
      pointsReward: number;
      imageKey: string;
      eventType: string | null;
      active: boolean;
    },
    periodStart: Date,
    periodEnd: Date,
  ) {
    const wallet = await this.ensureWallet(tx, userId);
    const progressRow = await this.ensureProgress(tx, {
      userId,
      missionId: mission.id,
      periodStart,
      periodEnd,
    });

    if (progressRow.completed) {
      return this.serializeMission(
        mission,
        progressRow,
        periodStart,
        periodEnd,
        this.serializeWallet(wallet),
      );
    }

    const incremented = await tx.userMissionProgress.updateMany({
      where: {
        id: progressRow.id,
        completed: false,
        progress: { lt: mission.target },
      },
      data: { progress: { increment: 1 } },
    });
    const fresh = await tx.userMissionProgress.findUniqueOrThrow({
      where: { id: progressRow.id },
    });
    if (incremented.count !== 1) {
      return this.serializeMission(
        mission,
        fresh,
        periodStart,
        periodEnd,
        this.serializeWallet(wallet),
      );
    }

    const nextProgress = fresh.progress;

    let completed: boolean = fresh.completed;
    let completedAt: Date | null = fresh.completedAt;
    let walletState = wallet;

    if (nextProgress >= mission.target) {
      const marked = await tx.userMissionProgress.updateMany({
        where: { id: progressRow.id, completed: false },
        data: { completed: true, completedAt: new Date() },
      });

      if (marked.count === 1) {
        walletState = await this.applyWalletDelta(tx, wallet.id, {
          pointsDelta: mission.pointsReward,
        });
        await tx.rewardLedgerEntry.create({
          data: {
            userId,
            walletId: wallet.id,
            type: 'MISSION_REWARD',
            pointsDelta: mission.pointsReward,
            referenceType: 'RewardMission',
            referenceId: mission.id,
            metadata: {
              progressId: progressRow.id,
              periodStart: periodStart.toISOString(),
              eventType: mission.eventType,
            },
          },
        });
        completed = true;
        completedAt = new Date();
      }
    }

    return this.serializeMission(
      mission,
      {
        ...progressRow,
        progress: nextProgress,
        completed,
        completedAt,
      },
      periodStart,
      periodEnd,
      this.serializeWallet(walletState),
    );
  }

  async listCatalog() {
    const items = await this.prisma.rewardCatalogItem.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });

    return items.map((item) => this.serializeCatalogItem(item));
  }

  async convert(userId: string, dto: ConvertRewardsDto) {
    if (dto.conversion === RewardConversionKind.GOLD_TO_DIAMOND) {
      throw new ServiceUnavailableException(
        'Gold to Diamond conversion is not configured',
      );
    }

    const pack =
      POINTS_TO_GOLD_PACKAGES[dto.amount as PointsToGoldAmount] ?? null;
    if (!pack) {
      throw new BadRequestException(
        'Invalid conversion amount. Allowed values: 1, 5',
      );
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const wallet = await this.ensureWallet(tx, userId);
      const updated = await tx.rewardWallet.updateMany({
        where: { id: wallet.id, points: { gte: pack.pointsCost } },
        data: {
          points: { decrement: pack.pointsCost },
          gold: { increment: pack.goldGranted },
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException('Insufficient points');
      }

      await tx.rewardLedgerEntry.create({
        data: {
          userId,
          walletId: wallet.id,
          type: 'POINTS_TO_GOLD',
          pointsDelta: -pack.pointsCost,
          goldDelta: pack.goldGranted,
          referenceType: 'Conversion',
          referenceId: String(dto.amount),
          metadata: {
            conversion: dto.conversion,
            amount: dto.amount,
            pointsCost: pack.pointsCost,
            goldGranted: pack.goldGranted,
          },
        },
      });

      const next = await tx.rewardWallet.findUniqueOrThrow({
        where: { id: wallet.id },
        select: WALLET_SELECT,
      });
      return this.serializeWallet(next);
    });
  }

  async redeem(userId: string, dto: RedeemRewardDto) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const item = await tx.rewardCatalogItem.findUnique({
        where: { id: dto.catalogItemId },
      });
      if (!item) {
        throw new NotFoundException('Reward not found');
      }
      if (!item.active) {
        throw new BadRequestException('Reward is inactive');
      }
      if (item.price <= UNCONFIGURED_PRICE) {
        throw new BadRequestException('Reward price is not configured');
      }
      if (item.currency !== 'GOLD' && item.currency !== 'DIAMOND') {
        throw new BadRequestException('Invalid reward currency');
      }

      const wallet = await this.ensureWallet(tx, userId);
      const balanceField = item.currency === 'GOLD' ? 'gold' : 'diamond';
      const debit =
        item.currency === 'GOLD'
          ? { gold: { decrement: item.price } }
          : { diamond: { decrement: item.price } };

      const spent = await tx.rewardWallet.updateMany({
        where: {
          id: wallet.id,
          [balanceField]: { gte: item.price },
        },
        data: debit,
      });
      if (spent.count !== 1) {
        throw new BadRequestException(
          item.currency === 'GOLD'
            ? 'Insufficient gold'
            : 'Insufficient diamond',
        );
      }

      const redemption = await tx.rewardRedemption.create({
        data: {
          userId,
          walletId: wallet.id,
          catalogItemId: item.id,
          currency: item.currency,
          amount: item.price,
          quantity: 1,
          status: 'PENDING',
        },
        include: {
          catalogItem: { select: { name: true, imageKey: true } },
        },
      });

      await tx.rewardRedemptionStatusEvent.create({
        data: {
          redemptionId: redemption.id,
          fromStatus: null,
          toStatus: 'PENDING',
          actorUserId: userId,
        },
      });

      await tx.rewardLedgerEntry.create({
        data: {
          userId,
          walletId: wallet.id,
          type: 'REDEMPTION',
          goldDelta: item.currency === 'GOLD' ? -item.price : 0,
          diamondDelta: item.currency === 'DIAMOND' ? -item.price : 0,
          referenceType: 'RewardRedemption',
          referenceId: redemption.id,
          metadata: {
            catalogItemId: item.id,
            imageKey: item.imageKey,
          },
        },
      });

      const nextWallet = await tx.rewardWallet.findUniqueOrThrow({
        where: { id: wallet.id },
        select: WALLET_SELECT,
      });

      return {
        redemption: this.serializeRedemption(redemption),
        wallet: this.serializeWallet(nextWallet),
      };
    });
  }

  async listRedemptions(userId: string) {
    const rows = await this.prisma.rewardRedemption.findMany({
      where: { userId },
      include: {
        catalogItem: { select: { name: true, imageKey: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => this.serializeRedemption(row));
  }

  async getRedemption(userId: string, id: string) {
    const row = await this.prisma.rewardRedemption.findFirst({
      where: { id, userId },
      include: {
        catalogItem: { select: { name: true, imageKey: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Redemption not found');
    }
    return this.serializeRedemption(row);
  }

  private async claimEventReceipt(
    tx: Prisma.TransactionClient,
    data: {
      userId: string;
      eventType: string;
      referenceId: string;
      missionId: string;
      periodStart: Date;
    },
  ) {
    const inserted = await tx.rewardEventReceipt.createMany({
      data: [data],
      skipDuplicates: true,
    });
    return inserted.count === 1;
  }

  private async readWallet(userId: string) {
    const existing = await this.prisma.rewardWallet.findUnique({
      where: { userId },
      select: WALLET_SELECT,
    });
    if (existing) {
      return existing;
    }

    return this.prisma.$transaction((tx: Prisma.TransactionClient) =>
      this.createWallet(tx, userId),
    );
  }

  private async ensureWallet(tx: Prisma.TransactionClient, userId: string) {
    const existing = await tx.rewardWallet.findUnique({
      where: { userId },
      select: WALLET_SELECT,
    });
    if (existing) {
      return existing;
    }

    return this.createWallet(tx, userId);
  }

  private async createWallet(tx: Prisma.TransactionClient, userId: string) {
    await tx.rewardWallet.createMany({
      data: [{ userId }],
      skipDuplicates: true,
    });
    return tx.rewardWallet.findUniqueOrThrow({
      where: { userId },
      select: WALLET_SELECT,
    });
  }

  private async ensureProgress(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      missionId: string;
      periodStart: Date;
      periodEnd: Date;
    },
  ) {
    const existing = await tx.userMissionProgress.findUnique({
      where: {
        userId_missionId_periodStart: {
          userId: params.userId,
          missionId: params.missionId,
          periodStart: params.periodStart,
        },
      },
    });
    if (existing) {
      return existing;
    }

    await tx.userMissionProgress.createMany({
      data: [
        {
          userId: params.userId,
          missionId: params.missionId,
          periodStart: params.periodStart,
          periodEnd: params.periodEnd,
        },
      ],
      skipDuplicates: true,
    });
    return tx.userMissionProgress.findUniqueOrThrow({
      where: {
        userId_missionId_periodStart: {
          userId: params.userId,
          missionId: params.missionId,
          periodStart: params.periodStart,
        },
      },
    });
  }

  private async applyWalletDelta(
    tx: Prisma.TransactionClient,
    walletId: string,
    delta: { pointsDelta?: number; goldDelta?: number; diamondDelta?: number },
  ) {
    const pointsDelta = delta.pointsDelta ?? 0;
    const goldDelta = delta.goldDelta ?? 0;
    const diamondDelta = delta.diamondDelta ?? 0;

    if (pointsDelta < 0 || goldDelta < 0 || diamondDelta < 0) {
      throw new BadRequestException(
        'Negative wallet delta is not allowed here',
      );
    }

    return tx.rewardWallet.update({
      where: { id: walletId },
      data: {
        points: { increment: pointsDelta },
        gold: { increment: goldDelta },
        diamond: { increment: diamondDelta },
      },
      select: WALLET_SELECT,
    });
  }

  private serializeWallet(wallet: {
    points: number;
    gold: number;
    diamond: number;
  }) {
    return {
      points: wallet.points,
      gold: wallet.gold,
      diamond: wallet.diamond,
    };
  }

  private serializeConversions() {
    return {
      pointsToGold: Object.entries(POINTS_TO_GOLD_PACKAGES).map(
        ([amount, pack]) => ({
          amount: Number(amount),
          pointsCost: pack.pointsCost,
          goldGranted: pack.goldGranted,
          enabled: true,
        }),
      ),
      goldToDiamond: {
        enabled: GOLD_TO_DIAMOND_RATE != null,
        rate: GOLD_TO_DIAMOND_RATE,
      },
    };
  }

  private serializeMission(
    mission: {
      id: string;
      title: string;
      description: string;
      category: string;
      period: MissionPeriod;
      target: number;
      pointsReward: number;
      imageKey: string;
      eventType?: string | null;
      catalogKey?: string | null;
      pillar?: string | null;
      role?: string | null;
      eventImplemented?: boolean;
      active: boolean;
    },
    progress:
      | {
          progress: number;
          completed: boolean;
          completedAt: Date | null;
        }
      | undefined,
    periodStart: Date,
    periodEnd: Date,
    wallet?: { points: number; gold: number; diamond: number },
    cycleExtra?: { daysCompleted?: number; weeksCompleted?: number } | null,
  ) {
    const current = progress?.progress ?? 0;
    const implemented = Boolean(mission.eventImplemented);
    const payload = {
      id: mission.id,
      title: mission.title,
      description: mission.description,
      category: mission.category,
      period: mission.period,
      imageKey: mission.imageKey,
      eventType: mission.eventType || null,
      catalogKey: mission.catalogKey ?? null,
      pillar: mission.pillar ?? null,
      role: mission.role ?? 'LEGACY',
      eventImplemented: implemented,
      functional: implemented,
      automatic: Boolean(mission.eventType) && implemented,
      rewardPoints: mission.pointsReward,
      target: mission.target,
      current,
      completed: Boolean(progress?.completed),
      completedAt: progress?.completedAt ?? null,
      periodStart,
      periodEnd,
      active: mission.active,
      ...(cycleExtra?.daysCompleted != null
        ? { daysCompleted: cycleExtra.daysCompleted }
        : {}),
      ...(cycleExtra?.weeksCompleted != null
        ? { weeksCompleted: cycleExtra.weeksCompleted }
        : {}),
    };
    return wallet ? { ...payload, wallet } : payload;
  }

  private serializeCatalogItem(item: {
    id: string;
    name: string;
    description: string;
    imageKey: string;
    currency: RewardCurrencyCode;
    price: number;
    sortOrder: number;
  }) {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      imageKey: item.imageKey,
      currency: item.currency,
      price: item.price,
      priceConfigured: item.price > UNCONFIGURED_PRICE,
      premium: item.currency === 'DIAMOND',
      sortOrder: item.sortOrder,
    };
  }

  private serializeRedemption(row: {
    id: string;
    catalogItemId: string;
    currency: RewardCurrencyCode;
    amount: number;
    quantity?: number;
    status: string;
    createdAt: Date;
    updatedAt?: Date;
    approvedAt?: Date | null;
    deliveredAt: Date | null;
    cancelledAt?: Date | null;
    adminNote?: string | null;
    cancellationReason?: string | null;
    deliveryNote?: string | null;
    catalogItem: { name: string; imageKey: string };
  }) {
    const note =
      row.status === 'CANCELLED'
        ? row.cancellationReason || row.adminNote || null
        : row.status === 'DELIVERED'
          ? row.deliveryNote || row.adminNote || null
          : row.adminNote || null;

    return {
      id: row.id,
      catalogItemId: row.catalogItemId,
      reward: {
        name: row.catalogItem.name,
        imageKey: row.catalogItem.imageKey,
      },
      name: row.catalogItem.name,
      imageKey: row.catalogItem.imageKey,
      currency: row.currency,
      price: row.amount,
      cost: row.amount,
      quantity: row.quantity ?? 1,
      status: row.status,
      message: userRedemptionMessage(row.status),
      adminNote: note,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt ?? row.createdAt,
      approvedAt: row.approvedAt ?? null,
      deliveredAt: row.deliveredAt,
      cancelledAt: row.cancelledAt ?? null,
    };
  }

  private asRotationPick(
    mission: RotationMissionPick & Record<string, unknown>,
  ): RotationMissionPick {
    return {
      id: mission.id,
      period: mission.period,
      catalogKey: (mission.catalogKey as string | null) ?? null,
      pillar: (mission.pillar as string | null) ?? null,
      role: (mission.role as string) ?? 'LEGACY',
      eventType: mission.eventType ?? null,
      active: mission.active,
      eventImplemented: Boolean(mission.eventImplemented),
    };
  }

  private filterFeaturedMissions<T extends RotationMissionPick>(
    missions: T[],
    period: MissionPeriod,
    periodStart: Date,
  ): T[] {
    const picks = selectFeaturedForPeriod(
      missions.map((m) => this.asRotationPick(m)),
      period,
      periodStart,
    );
    const byId = new Map(missions.map((mission) => [mission.id, mission]));
    return picks
      .map((pick) => byId.get(pick.id))
      .filter((mission): mission is T => mission != null);
  }

  private featuredIdsForAllPeriods(
    missions: RotationMissionPick[],
    now: Date,
  ): Set<string> {
    const ids = new Set<string>();
    for (const period of ['DAILY', 'WEEKLY', 'MONTHLY'] as const) {
      const { periodStart } = currentPeriodWindow(period, now);
      for (const pick of selectFeaturedForPeriod(
        missions.map((m) => this.asRotationPick(m)),
        period,
        periodStart,
      )) {
        ids.add(pick.id);
      }
    }
    return ids;
  }

  private async loadFeaturedIdsByPeriod(
    tx: Prisma.TransactionClient,
    at: Date,
  ): Promise<Map<MissionPeriod, Set<string>>> {
    const missions = await tx.rewardMission.findMany({
      where: { active: true },
      select: MISSION_SELECT,
    });
    const map = new Map<MissionPeriod, Set<string>>();
    for (const period of ['DAILY', 'WEEKLY', 'MONTHLY'] as const) {
      const { periodStart } = currentPeriodWindow(period, at);
      const picks = selectFeaturedForPeriod(
        missions.map((m) => this.asRotationPick(m)),
        period,
        periodStart,
      );
      map.set(period, new Set(picks.map((p) => p.id)));
    }
    return map;
  }

  private async loadCycleProgress(
    userId: string,
    period: 'WEEKLY' | 'MONTHLY',
    periodStart: Date,
  ) {
    if (period === 'WEEKLY') {
      const rows = await this.prisma.userRewardCycleCompletion.count({
        where: {
          userId,
          cycle: 'DAILY_ALL',
          periodStart: {
            gte: periodStart,
            lt: new Date(periodStart.getTime() + 7 * 86_400_000),
          },
        },
      });
      return { daysCompleted: rows };
    }

    const { weeklyPeriodStartsInMonth } = await import('./rewards.rotation');
    const weeks = weeklyPeriodStartsInMonth(periodStart);
    if (weeks.length === 0) return { weeksCompleted: 0 };
    const count = await this.prisma.userRewardCycleCompletion.count({
      where: {
        userId,
        cycle: 'WEEKLY_ALL',
        periodStart: { in: weeks },
      },
    });
    return { weeksCompleted: count };
  }

  private async maybeCompleteAggregators(
    tx: Prisma.TransactionClient,
    userId: string,
    at: Date,
  ) {
    const missions = await tx.rewardMission.findMany({
      where: { active: true },
      select: MISSION_SELECT,
    });

    const dailyWindow = currentPeriodWindow('DAILY', at);
    const dailyFeatured = selectFeaturedForPeriod(
      missions.map((m) => this.asRotationPick(m)),
      'DAILY',
      dailyWindow.periodStart,
    ).filter((m) => m.role !== 'FIXED_ADS' || m.eventImplemented);

    // Require all featured daily slots that are functional (ads excluded until Web SSV).
    const requiredDaily = dailyFeatured.filter((m) => m.eventImplemented);
    if (requiredDaily.length >= 2) {
      const progress = await tx.userMissionProgress.findMany({
        where: {
          userId,
          periodStart: dailyWindow.periodStart,
          missionId: { in: requiredDaily.map((m) => m.id) },
          completed: true,
        },
      });
      if (progress.length >= requiredDaily.length) {
        const inserted = await tx.userRewardCycleCompletion.createMany({
          data: [
            {
              id: crypto.randomUUID(),
              userId,
              cycle: 'DAILY_ALL',
              periodStart: dailyWindow.periodStart,
              periodEnd: dailyWindow.periodEnd,
            },
          ],
          skipDuplicates: true,
        });
        if (inserted.count === 1) {
          await this.recordEventWithin(
            tx,
            userId,
            REWARD_EVENTS.DAILY_ALL_COMPLETED,
            {
              referenceType: 'DailyAll',
              referenceId: dailyWindow.periodStart.toISOString(),
            },
            at,
            false,
          );
        }
      }
    }

    const weeklyWindow = currentPeriodWindow('WEEKLY', at);
    const weeklyFeatured = selectFeaturedForPeriod(
      missions.map((m) => this.asRotationPick(m)),
      'WEEKLY',
      weeklyWindow.periodStart,
    ).filter((m) => m.eventImplemented);
    if (weeklyFeatured.length >= 1) {
      const progress = await tx.userMissionProgress.findMany({
        where: {
          userId,
          periodStart: weeklyWindow.periodStart,
          missionId: { in: weeklyFeatured.map((m) => m.id) },
          completed: true,
        },
      });
      if (progress.length >= weeklyFeatured.length) {
        const inserted = await tx.userRewardCycleCompletion.createMany({
          data: [
            {
              id: crypto.randomUUID(),
              userId,
              cycle: 'WEEKLY_ALL',
              periodStart: weeklyWindow.periodStart,
              periodEnd: weeklyWindow.periodEnd,
            },
          ],
          skipDuplicates: true,
        });
        if (inserted.count === 1) {
          await this.recordEventWithin(
            tx,
            userId,
            REWARD_EVENTS.WEEKLY_ALL_COMPLETED,
            {
              referenceType: 'WeeklyAll',
              referenceId: weeklyWindow.periodStart.toISOString(),
            },
            at,
            false,
          );
        }
      }
    }
  }

  private summarizeMissions(
    missions: Array<{ id: string; period: MissionPeriod } & RotationMissionPick>,
    progressRows: Array<{
      missionId: string;
      completed: boolean;
      periodStart: Date;
    }>,
    now = new Date(),
    featuredIds?: Set<string>,
  ) {
    const periods: MissionPeriod[] = ['DAILY', 'WEEKLY', 'MONTHLY'];
    const result: Record<string, { total: number; completed: number }> = {};

    for (const period of periods) {
      const { periodStart } = currentPeriodWindow(period, now);
      const featured = this.filterFeaturedMissions(
        missions.map((m) => this.asRotationPick(m)),
        period,
        periodStart,
      );
      const periodMissions = featuredIds
        ? featured.filter((m) => featuredIds.has(m.id))
        : featured;
      const completed = periodMissions.filter((mission) =>
        progressRows.some(
          (row) =>
            row.missionId === mission.id &&
            row.completed &&
            row.periodStart.getTime() === periodStart.getTime(),
        ),
      ).length;
      result[period] = { total: periodMissions.length, completed };
    }

    return result;
  }
}
