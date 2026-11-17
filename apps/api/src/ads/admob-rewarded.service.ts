import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { REWARD_EVENTS } from '../rewards/rewards.constants';
import { currentPeriodWindow } from '../rewards/rewards.periods';
import { RewardsService } from '../rewards/rewards.service';
import {
  ADMOB_TEST_REWARDED_ANDROID,
  ADMOB_TEST_REWARDED_IOS,
  ADMOB_REWARD_SESSION_TTL_MS,
  admobRewardedCooldownSeconds,
  admobRewardedDailyMax,
  rewardedAdUnitAllowlist,
} from './admob-rewarded.config';
import {
  loadAdMobVerifierKeys,
  parseAdMobSsvQuery,
  verifyAdMobSsvSignature,
} from './admob-ssv.verifier';

@Injectable()
export class AdMobRewardedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rewards: RewardsService,
  ) {}

  async prepareSession(userId: string) {
    await this.assertWithinLimits(userId, new Date());
    const expiresAt = new Date(Date.now() + ADMOB_REWARD_SESSION_TTL_MS);
    const session = await this.prisma.adMobRewardSession.create({
      data: { userId, expiresAt },
      select: { id: true, expiresAt: true },
    });
    const allowlist = rewardedAdUnitAllowlist();
    return {
      sessionId: session.id,
      customData: session.id,
      expiresAt: session.expiresAt.toISOString(),
      adUnits: {
        android:
          process.env.ADMOB_REWARDED_ANDROID_UNIT_ID ??
          ADMOB_TEST_REWARDED_ANDROID,
        ios:
          process.env.ADMOB_REWARDED_IOS_UNIT_ID ?? ADMOB_TEST_REWARDED_IOS,
      },
      allowedAdUnits: [...allowlist],
      cooldownSeconds: admobRewardedCooldownSeconds(),
      dailyMax: admobRewardedDailyMax(),
    };
  }

  async getSessionStatus(userId: string, sessionId: string) {
    const session = await this.prisma.adMobRewardSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new NotFoundException('Sessão de anúncio não encontrada.');
    }
    const transaction = session.transactionId
      ? await this.prisma.adMobSsvTransaction.findUnique({
          where: { transactionId: session.transactionId },
        })
      : null;
    const confirmed = Boolean(session.consumedAt && transaction);
    const wallet = confirmed
      ? await this.prisma.rewardWallet.findUnique({
          where: { userId },
          select: { points: true, gold: true, diamond: true },
        })
      : null;
    return {
      sessionId: session.id,
      status: confirmed
        ? 'confirmed'
        : session.expiresAt.getTime() < Date.now()
          ? 'expired'
          : 'pending',
      transactionId: session.transactionId,
      confirmedAt: session.consumedAt?.toISOString() ?? null,
      wallet: wallet
        ? {
            points: wallet.points,
            gold: wallet.gold,
            diamond: wallet.diamond,
          }
        : null,
    };
  }

  async handleSsvCallback(rawQuery: string) {
    if (!rawQuery?.trim()) {
      throw new BadRequestException('Missing query string');
    }

    const keys = await loadAdMobVerifierKeys();
    verifyAdMobSsvSignature(rawQuery, keys);
    const params = parseAdMobSsvQuery(rawQuery);

    const allowlist = rewardedAdUnitAllowlist();
    if (!allowlist.has(params.adUnit)) {
      throw new BadRequestException('Unexpected ad unit');
    }
    if (!params.customData?.trim()) {
      throw new BadRequestException('custom_data is required');
    }

    const existing = await this.prisma.adMobSsvTransaction.findUnique({
      where: { transactionId: params.transactionId },
    });
    if (existing) {
      return { status: 'duplicate', transactionId: params.transactionId };
    }

    const sessionId = params.customData.trim();
    const eventAt =
      params.timestamp && /^\d+$/.test(params.timestamp)
        ? new Date(Number(params.timestamp))
        : new Date();

    try {
      await this.prisma.$transaction(async (tx) => {
        const session = await tx.adMobRewardSession.findUnique({
          where: { id: sessionId },
        });
        if (!session) {
          throw new BadRequestException('Unknown reward session');
        }
        if (session.consumedAt) {
          throw new ConflictException('Reward session already consumed');
        }
        if (session.expiresAt.getTime() < Date.now()) {
          throw new BadRequestException('Reward session expired');
        }

        await this.assertWithinLimits(session.userId, eventAt, tx);

        await tx.adMobSsvTransaction.create({
          data: {
            transactionId: params.transactionId,
            userId: session.userId,
            sessionId: session.id,
            adUnitId: params.adUnit,
            adNetwork: params.adNetwork ?? null,
            rewardAmount: params.rewardAmount ?? null,
            rewardItem: params.rewardItem ?? null,
            eventAt,
          },
        });

        await tx.adMobRewardSession.update({
          where: { id: session.id },
          data: {
            consumedAt: new Date(),
            transactionId: params.transactionId,
          },
        });

        await this.rewards.recordEvent(
          session.userId,
          REWARD_EVENTS.WATCH_AD,
          {
            referenceType: 'AdMobSsvTransaction',
            referenceId: params.transactionId,
          },
          eventAt,
          tx,
        );
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { status: 'duplicate', transactionId: params.transactionId };
      }
      throw error;
    }

    return { status: 'processed', transactionId: params.transactionId };
  }

  private async assertWithinLimits(
    userId: string,
    at: Date,
    db?: Prisma.TransactionClient,
  ) {
    const client = db ?? this.prisma;
    const dailyMax = admobRewardedDailyMax();
    const cooldownSeconds = admobRewardedCooldownSeconds();
    const { periodStart, periodEnd } = currentPeriodWindow('DAILY', at);

    const todayCount = await client.adMobSsvTransaction.count({
      where: {
        userId,
        createdAt: { gte: periodStart, lt: periodEnd },
      },
    });
    if (todayCount >= dailyMax) {
      throw new HttpException(
        'Limite diário de anúncios recompensados atingido.',
        429,
      );
    }

    if (cooldownSeconds > 0) {
      const last = await client.adMobSsvTransaction.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (last) {
        const elapsed = (at.getTime() - last.createdAt.getTime()) / 1000;
        if (elapsed < cooldownSeconds) {
          throw new HttpException(
            'Aguarde antes de assistir outro anúncio.',
            429,
          );
        }
      }
    }
  }
}
