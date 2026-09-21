import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import {
  GOLD_TO_DIAMOND_RATE,
  POINTS_TO_GOLD_PACKAGES,
  UNCONFIGURED_PRICE,
  isSupportedRewardEvent,
  type MissionPeriod,
  type PointsToGoldAmount,
  type RewardCurrencyCode,
} from './rewards.constants';
import {
  ConvertRewardsDto,
  RewardConversionKind,
} from './dto/convert-rewards.dto';
import { ListMissionsQueryDto } from './dto/list-missions-query.dto';
import { RedeemRewardDto } from './dto/redeem-reward.dto';
import { currentPeriodWindow } from './rewards.periods';
import { userRedemptionMessage } from './rewards.redemption';

function isUniqueConflict(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

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
    const wallet = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => this.ensureWallet(tx, userId),
    );

    const missions = await this.prisma.rewardMission.findMany({
      where: { active: true },
      select: { id: true, period: true },
    });

    const progressRows = await this.prisma.userMissionProgress.findMany({
      where: {
        userId,
        missionId: { in: missions.map((mission) => mission.id) },
      },
    });

    const summary = this.summarizeMissions(missions, progressRows);

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
      orderBy: { createdAt: 'asc' },
    });

    const progressRows = await this.prisma.userMissionProgress.findMany({
      where: {
        userId,
        periodStart,
        missionId: { in: missions.map((mission) => mission.id) },
      },
    });
    const progressByMission = new Map(
      progressRows.map((row) => [row.missionId, row]),
    );

    return missions.map((mission) =>
      this.serializeMission(
        mission,
        progressByMission.get(mission.id),
        periodStart,
        periodEnd,
      ),
    );
  }

  async recordEvent(
    userId: string,
    eventType: string,
    metadata: { referenceType: string; referenceId: string },
    at = new Date(),
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

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const missions = await tx.rewardMission.findMany({
        where: { active: true, eventType },
      });

      const applied: Awaited<
        ReturnType<RewardsService['applyProgressIncrement']>
      >[] = [];
      for (const mission of missions) {
        const { periodStart, periodEnd } = currentPeriodWindow(
          mission.period,
          at,
        );

        try {
          await tx.rewardEventReceipt.create({
            data: {
              userId,
              eventType,
              referenceId: metadata.referenceId,
              missionId: mission.id,
              periodStart,
            },
          });
        } catch (error) {
          if (isUniqueConflict(error)) {
            continue;
          }
          throw error;
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

      return { eventType: eventType, applied };
    });
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

    const nextProgress = Math.min(mission.target, progressRow.progress + 1);

    await tx.userMissionProgress.update({
      where: { id: progressRow.id },
      data: { progress: nextProgress },
    });

    let completed: boolean = progressRow.completed;
    let completedAt: Date | null = progressRow.completedAt;
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

  private async ensureWallet(tx: Prisma.TransactionClient, userId: string) {
    const existing = await tx.rewardWallet.findUnique({
      where: { userId },
      select: WALLET_SELECT,
    });
    if (existing) {
      return existing;
    }

    try {
      return await tx.rewardWallet.create({
        data: { userId },
        select: WALLET_SELECT,
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        return tx.rewardWallet.findUniqueOrThrow({
          where: { userId },
          select: WALLET_SELECT,
        });
      }
      throw error;
    }
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

    try {
      return await tx.userMissionProgress.create({
        data: {
          userId: params.userId,
          missionId: params.missionId,
          periodStart: params.periodStart,
          periodEnd: params.periodEnd,
        },
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
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
      throw error;
    }
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
  ) {
    const current = progress?.progress ?? 0;
    const payload = {
      id: mission.id,
      title: mission.title,
      description: mission.description,
      category: mission.category,
      period: mission.period,
      imageKey: mission.imageKey,
      eventType: mission.eventType || null,
      automatic: Boolean(mission.eventType),
      rewardPoints: mission.pointsReward,
      target: mission.target,
      current,
      completed: Boolean(progress?.completed),
      completedAt: progress?.completedAt ?? null,
      periodStart,
      periodEnd,
      active: mission.active,
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

  private summarizeMissions(
    missions: Array<{ id: string; period: MissionPeriod }>,
    progressRows: Array<{
      missionId: string;
      completed: boolean;
      periodStart: Date;
    }>,
  ) {
    const periods: MissionPeriod[] = ['DAILY', 'WEEKLY', 'MONTHLY'];
    const result: Record<string, { total: number; completed: number }> = {};

    for (const period of periods) {
      const { periodStart } = currentPeriodWindow(period);
      const periodMissions = missions.filter(
        (mission) => mission.period === period,
      );
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
