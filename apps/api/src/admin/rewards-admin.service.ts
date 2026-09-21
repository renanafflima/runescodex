import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { userRedemptionMessage } from '../rewards/rewards.redemption';
import { ApproveRedemptionDto } from './dto/approve-redemption.dto';
import { CancelRedemptionDto } from './dto/cancel-redemption.dto';
import { DeliverRedemptionDto } from './dto/deliver-redemption.dto';
import { ListAdminRedemptionsQueryDto } from './dto/list-admin-redemptions-query.dto';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LIST_INCLUDE = {
  user: { select: { id: true, email: true } },
  catalogItem: { select: { id: true, name: true, imageKey: true } },
  approvedBy: { select: { id: true, email: true } },
  deliveredBy: { select: { id: true, email: true } },
  cancelledBy: { select: { id: true, email: true } },
} satisfies Prisma.RewardRedemptionInclude;

const DETAIL_INCLUDE = {
  ...LIST_INCLUDE,
  statusEvents: {
    orderBy: { createdAt: 'asc' as const },
    include: { actor: { select: { id: true, email: true } } },
  },
} satisfies Prisma.RewardRedemptionInclude;

@Injectable()
export class RewardsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAdminRedemptionsQueryDto) {
    const where = this.buildWhere(query);
    const [countRows, items] = await Promise.all([
      this.prisma.rewardRedemption.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.rewardRedemption.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    ]);

    const counts = {
      PENDING: 0,
      APPROVED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    };
    for (const row of countRows) {
      counts[row.status] = row._count._all;
    }

    return {
      counts,
      items: items.map((row) => this.serialize(row)),
    };
  }

  async getById(id: string) {
    const row = await this.prisma.rewardRedemption.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException('Redemption not found');
    }
    return this.serialize(row, true);
  }

  async approve(adminUserId: string, id: string, dto: ApproveRedemptionDto) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const row = await tx.rewardRedemption.findUnique({ where: { id } });
      if (!row) {
        throw new NotFoundException('Redemption not found');
      }
      if (row.status !== 'PENDING') {
        throw new ConflictException(
          `Cannot approve a redemption with status ${row.status}`,
        );
      }

      const moved = await tx.rewardRedemption.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedByUserId: adminUserId,
          adminNote: dto.adminNote ?? row.adminNote,
        },
      });
      if (moved.count !== 1) {
        throw new ConflictException('Redemption was already processed');
      }

      await tx.rewardRedemptionStatusEvent.create({
        data: {
          redemptionId: id,
          fromStatus: 'PENDING',
          toStatus: 'APPROVED',
          actorUserId: adminUserId,
          note: dto.adminNote,
        },
      });

      return this.loadDetail(tx, id);
    });
  }

  async deliver(adminUserId: string, id: string, dto: DeliverRedemptionDto) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const row = await tx.rewardRedemption.findUnique({ where: { id } });
      if (!row) {
        throw new NotFoundException('Redemption not found');
      }
      if (row.status !== 'APPROVED') {
        throw new ConflictException(
          `Cannot deliver a redemption with status ${row.status}`,
        );
      }

      const moved = await tx.rewardRedemption.updateMany({
        where: { id, status: 'APPROVED' },
        data: {
          status: 'DELIVERED',
          deliveredAt: new Date(),
          deliveredByUserId: adminUserId,
          deliveryNote: dto.deliveryNote ?? row.deliveryNote,
        },
      });
      if (moved.count !== 1) {
        throw new ConflictException('Redemption was already processed');
      }

      await tx.rewardRedemptionStatusEvent.create({
        data: {
          redemptionId: id,
          fromStatus: 'APPROVED',
          toStatus: 'DELIVERED',
          actorUserId: adminUserId,
          note: dto.deliveryNote,
        },
      });

      return this.loadDetail(tx, id);
    });
  }

  async cancel(adminUserId: string, id: string, dto: CancelRedemptionDto) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const row = await tx.rewardRedemption.findUnique({ where: { id } });
      if (!row) {
        throw new NotFoundException('Redemption not found');
      }
      if (row.status === 'CANCELLED') {
        throw new ConflictException('Redemption is already cancelled');
      }
      if (row.status === 'DELIVERED') {
        throw new BadRequestException(
          'Delivered redemptions cannot be cancelled',
        );
      }

      const now = new Date();
      const moved = await tx.rewardRedemption.updateMany({
        where: {
          id,
          status: { in: ['PENDING', 'APPROVED'] },
          refundedAt: null,
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancelledByUserId: adminUserId,
          cancellationReason: dto.cancellationReason,
          adminNote: dto.adminNote ?? row.adminNote,
          refundedAt: now,
        },
      });
      if (moved.count !== 1) {
        throw new ConflictException('Redemption was already processed');
      }

      const credit =
        row.currency === 'GOLD'
          ? { gold: { increment: row.amount } }
          : { diamond: { increment: row.amount } };
      await tx.rewardWallet.update({
        where: { id: row.walletId },
        data: credit,
      });

      await tx.rewardLedgerEntry.create({
        data: {
          userId: row.userId,
          walletId: row.walletId,
          type: 'REFUND',
          goldDelta: row.currency === 'GOLD' ? row.amount : 0,
          diamondDelta: row.currency === 'DIAMOND' ? row.amount : 0,
          referenceType: 'RewardRedemption',
          referenceId: row.id,
          metadata: {
            reason: 'ADMIN_CANCEL',
            currency: row.currency,
            amount: row.amount,
            quantity: row.quantity,
          },
        },
      });

      await tx.rewardRedemptionStatusEvent.create({
        data: {
          redemptionId: id,
          fromStatus: row.status,
          toStatus: 'CANCELLED',
          actorUserId: adminUserId,
          note: dto.cancellationReason ?? dto.adminNote,
        },
      });

      return this.loadDetail(tx, id);
    });
  }

  private async loadDetail(tx: Prisma.TransactionClient, id: string) {
    const row = await tx.rewardRedemption.findUniqueOrThrow({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    return this.serialize(row, true);
  }

  private buildWhere(
    query: ListAdminRedemptionsQueryDto,
  ): Prisma.RewardRedemptionWhereInput {
    const where: Prisma.RewardRedemptionWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }

    const user = query.user?.trim();
    if (user) {
      if (UUID_RE.test(user)) {
        where.userId = user;
      } else {
        where.user = { email: { contains: user, mode: 'insensitive' } };
      }
    }

    const reward = query.reward?.trim();
    if (reward) {
      if (UUID_RE.test(reward)) {
        where.catalogItemId = reward;
      } else {
        where.catalogItem = { name: { contains: reward, mode: 'insensitive' } };
      }
    }

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) {
        where.createdAt.gte = new Date(query.from);
      }
      if (query.to) {
        where.createdAt.lte = new Date(query.to);
      }
    }

    return where;
  }

  private serialize(
    row: {
      id: string;
      userId: string;
      catalogItemId: string;
      currency: string;
      amount: number;
      quantity: number;
      status: string;
      createdAt: Date;
      updatedAt: Date;
      approvedAt: Date | null;
      deliveredAt: Date | null;
      cancelledAt: Date | null;
      refundedAt: Date | null;
      adminNote: string | null;
      cancellationReason: string | null;
      deliveryNote: string | null;
      user?: { id: string; email: string };
      catalogItem?: { id: string; name: string; imageKey: string };
      approvedBy?: { id: string; email: string } | null;
      deliveredBy?: { id: string; email: string } | null;
      cancelledBy?: { id: string; email: string } | null;
      statusEvents?: Array<{
        id: string;
        fromStatus: string | null;
        toStatus: string;
        note: string | null;
        createdAt: Date;
        actorUserId: string;
        actor?: { id: string; email: string };
      }>;
    },
    withHistory = false,
  ) {
    const payload: Record<string, unknown> = {
      id: row.id,
      userId: row.userId,
      user: row.user ?? null,
      catalogItemId: row.catalogItemId,
      reward: row.catalogItem
        ? {
            id: row.catalogItem.id,
            name: row.catalogItem.name,
            imageKey: row.catalogItem.imageKey,
          }
        : null,
      currency: row.currency,
      price: row.amount,
      quantity: row.quantity,
      status: row.status,
      message: userRedemptionMessage(row.status),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      approvedAt: row.approvedAt,
      deliveredAt: row.deliveredAt,
      cancelledAt: row.cancelledAt,
      refundedAt: row.refundedAt,
      adminNote: row.adminNote,
      cancellationReason: row.cancellationReason,
      deliveryNote: row.deliveryNote,
      approvedBy: row.approvedBy ?? null,
      deliveredBy: row.deliveredBy ?? null,
      cancelledBy: row.cancelledBy ?? null,
    };
    if (withHistory) {
      payload.statusHistory = (row.statusEvents ?? []).map((event) => ({
        id: event.id,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        note: event.note,
        createdAt: event.createdAt,
        actor: event.actor ?? { id: event.actorUserId },
      }));
    }
    return payload;
  }
}
