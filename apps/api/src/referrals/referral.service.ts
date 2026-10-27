import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma } from '../../generated/prisma/client.js';
import { createTicketProtocol } from '../admin/insights/admin-text';
import { AdminAuditService } from '../audit/admin-audit.service';
import { licenseGrantsAccess } from '../billing/license-access';
import { pageResult, resolvePage } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

export const REFERRAL_TC = 100;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const USER_LABEL = {
  id: true,
  email: true,
  referralCode: true,
  activeCharacter: { select: { name: true } },
} as const;

type Tx = Prisma.TransactionClient;

function isUnique(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

function publicName(
  user: { activeCharacter?: { name: string } | null } | null,
) {
  return user?.activeCharacter?.name || 'Jogador';
}

function normalizeCode(value: string | undefined) {
  const code = value?.trim().toUpperCase() ?? '';
  if (!/^[A-Z0-9]{6,16}$/.test(code)) return '';
  return code;
}

function rewardLabel(status: string) {
  if (status === 'PENDING_DELIVERY') return 'Recompensa em preparação';
  if (status === 'DELIVERED') return 'Recompensa entregue';
  if (status === 'ON_HOLD') return 'Em análise';
  if (status === 'INELIGIBLE') return 'Inelegível';
  return 'Aguardando compra';
}

@Injectable()
export class ReferralService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async ensureCode(userId: string) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const current = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { referralCode: true },
      });
      if (!current) throw new NotFoundException('Usuário não encontrado.');
      if (current.referralCode) return current.referralCode;
      const code = this.generateCode();
      try {
        const updated = await this.prisma.user.updateMany({
          where: { id: userId, referralCode: null },
          data: { referralCode: code },
        });
        if (updated.count === 1) {
          await this.audit.record({
            actorUserId: userId,
            action: 'referral.code',
            entityType: 'user',
            entityId: userId,
            summary: 'Código de indicação criado',
          });
          return code;
        }
      } catch (error) {
        if (!isUnique(error)) throw error;
      }
    }
    throw new ConflictException(
      'Não foi possível criar o código de indicação.',
    );
  }

  async attribute(userId: string, rawCode: string | undefined) {
    const code = normalizeCode(rawCode);
    if (!code) return { attributed: false };
    const referrer = await this.prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!referrer) return { attributed: false };
    if (referrer.id === userId) {
      await this.audit.record({
        actorUserId: userId,
        action: 'referral.self',
        entityType: 'user',
        entityId: userId,
        summary: 'Autoindicação rejeitada',
      });
      return { attributed: false };
    }
    try {
      const row = await this.prisma.referralAttribution.create({
        data: {
          referrerUserId: referrer.id,
          referredUserId: userId,
          code,
        },
      });
      await this.audit.record({
        actorUserId: userId,
        action: 'referral.assigned',
        entityType: 'referral',
        entityId: row.id,
        summary: 'Indicação registrada no cadastro',
        metadata: { code },
      });
      return { attributed: true };
    } catch (error) {
      if (isUnique(error)) return { attributed: false };
      throw error;
    }
  }

  async accountView(
    userId: string,
    pageQuery: { page?: number; limit?: number },
  ) {
    const code = await this.ensureCode(userId);
    const { page, limit, skip } = resolvePage(pageQuery);
    const where = { referrerUserId: userId };
    const [rows, total, rewards] = await Promise.all([
      this.prisma.referralAttribution.findMany({
        where,
        include: {
          referred: { select: USER_LABEL },
          reward: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.referralAttribution.count({ where }),
      this.prisma.referralReward.groupBy({
        by: ['status'],
        where: { referrerUserId: userId },
        _count: { _all: true },
      }),
    ]);
    const byStatus = Object.fromEntries(
      rewards.map((row) => [row.status, row._count._all]),
    );
    const delivered = byStatus.DELIVERED ?? 0;
    const pendingDelivery = byStatus.PENDING_DELIVERY ?? 0;
    return {
      code,
      path: `/?ref=${code}`,
      rewardCoins: REFERRAL_TC,
      summary: {
        referred: total,
        waitingPurchase: Math.max(
          0,
          total - rewards.reduce((sum, row) => sum + row._count._all, 0),
        ),
        pendingDelivery,
        delivered,
        onHold: byStatus.ON_HOLD ?? 0,
        coinsDelivered: delivered * REFERRAL_TC,
      },
      ...pageResult(
        rows.map((row) => ({
          id: row.id,
          friend: publicName(row.referred),
          createdAt: row.createdAt.toISOString(),
          status: row.reward
            ? rewardLabel(row.reward.status)
            : 'Aguardando compra',
          validatedAt: row.reward?.releasedAt.toISOString() ?? null,
          deliveredAt: row.reward?.deliveredAt?.toISOString() ?? null,
        })),
        total,
        page,
        limit,
      ),
    };
  }

  async settlePaidOrder(orderId: string) {
    const order = await this.prisma.billingOrder.findUnique({
      where: { id: orderId },
      include: {
        license: true,
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!order || order.status !== 'PAID') return { created: false };
    const license = order.license;
    const payment = order.payments[0];
    if (
      !license ||
      license.source !== 'PURCHASE' ||
      license.orderId !== order.id ||
      !licenseGrantsAccess(license) ||
      payment?.status !== 'PAID'
    ) {
      return { created: false };
    }
    const attribution = await this.prisma.referralAttribution.findUnique({
      where: { referredUserId: order.userId },
      include: {
        reward: true,
        referrer: { select: USER_LABEL },
        referred: { select: USER_LABEL },
      },
    });
    if (
      !attribution ||
      attribution.referrerUserId === attribution.referredUserId
    ) {
      return { created: false };
    }
    if (attribution.reward) {
      if (
        !attribution.reward.ticketId &&
        attribution.reward.status === 'PENDING_DELIVERY'
      ) {
        await this.attachTicket(attribution.reward.id);
      }
      return { created: false, rewardId: attribution.reward.id };
    }
    try {
      return await this.prisma.$transaction((tx) =>
        this.createReward(tx, {
          attributionId: attribution.id,
          referrerUserId: attribution.referrerUserId,
          referredUserId: attribution.referredUserId,
          referrerName: publicName(attribution.referrer),
          referredName: publicName(attribution.referred),
          orderId: order.id,
          paymentId: payment.id,
          licenseId: license.id,
        }),
      );
    } catch (error) {
      if (!isUnique(error)) throw error;
      const existing = await this.prisma.referralReward.findUnique({
        where: { attributionId: attribution.id },
      });
      if (existing && !existing.ticketId) await this.attachTicket(existing.id);
      return { created: false, rewardId: existing?.id };
    }
  }

  async holdAfterRefund(orderId: string) {
    const reward = await this.prisma.referralReward.findUnique({
      where: { orderId },
    });
    if (!reward) return;
    if (reward.status === 'DELIVERED') {
      await this.prisma.referralReward.update({
        where: { id: reward.id },
        data: {
          reviewRequired: true,
          reviewReason:
            'O pagamento foi reembolsado ou contestado depois da entrega manual.',
        },
      });
      await this.note(
        reward,
        'O pagamento foi revertido depois da entrega. O histórico foi mantido para análise.',
      );
      await this.audit.record({
        actorUserId: reward.referrerUserId,
        action: 'referral.refund_after_delivery',
        entityType: 'referral_reward',
        entityId: reward.id,
        summary: 'Reembolso após entrega manual de TC',
        metadata: { orderId },
      });
      return;
    }
    if (reward.status !== 'PENDING_DELIVERY') return;
    await this.prisma.referralReward.updateMany({
      where: { id: reward.id, status: 'PENDING_DELIVERY' },
      data: {
        status: 'ON_HOLD',
        holdReason: 'Pagamento reembolsado ou contestado antes da entrega.',
      },
    });
    await this.note(
      reward,
      'Entrega bloqueada: o pagamento deixou de estar elegível.',
    );
    await this.audit.record({
      actorUserId: reward.referrerUserId,
      action: 'referral.ineligible',
      entityType: 'referral_reward',
      entityId: reward.id,
      summary: 'Recompensa bloqueada por reembolso',
      metadata: { orderId },
    });
  }

  async overview() {
    const [codes, attributions, rewards] = await Promise.all([
      this.prisma.user.count({ where: { referralCode: { not: null } } }),
      this.prisma.referralAttribution.count(),
      this.prisma.referralReward.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);
    const count = (status: string) =>
      rewards.find((row) => row.status === status)?._count._all ?? 0;
    const waiting = await this.prisma.referralAttribution.count({
      where: { stage: 'WAITING_PURCHASE' },
    });
    const pending = count('PENDING_DELIVERY');
    const delivered = count('DELIVERED');
    return {
      codes,
      attributions,
      waitingPurchase: waiting,
      pendingDelivery: pending,
      delivered,
      onHold: count('ON_HOLD'),
      ineligible: count('INELIGIBLE'),
      coinsPending: pending * REFERRAL_TC,
      coinsDelivered: delivered * REFERRAL_TC,
    };
  }

  async adminList(query: {
    page?: number;
    limit?: number;
    search?: string;
    stage?: string;
  }) {
    const { page, limit, skip } = resolvePage(query);
    const search = query.search?.trim();
    const stage =
      query.stage === 'WAITING_PURCHASE' || query.stage === 'REWARDED'
        ? query.stage
        : undefined;
    const where: Prisma.ReferralAttributionWhereInput = {
      ...(stage ? { stage } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search.toUpperCase() } },
              {
                referrer: {
                  email: { contains: search, mode: 'insensitive' as const },
                },
              },
              {
                referred: {
                  email: { contains: search, mode: 'insensitive' as const },
                },
              },
              {
                referrer: {
                  activeCharacter: {
                    name: { contains: search, mode: 'insensitive' as const },
                  },
                },
              },
              {
                referred: {
                  activeCharacter: {
                    name: { contains: search, mode: 'insensitive' as const },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.referralAttribution.count({ where }),
      this.prisma.referralAttribution.findMany({
        where,
        include: {
          referrer: { select: USER_LABEL },
          referred: { select: USER_LABEL },
          reward: {
            select: { id: true, status: true, ticketId: true, orderId: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    return pageResult(
      rows.map((row) => ({
        id: row.id,
        code: row.code,
        stage: row.stage,
        createdAt: row.createdAt.toISOString(),
        referrer: {
          id: row.referrer.id,
          name: publicName(row.referrer),
          email: row.referrer.email,
        },
        referred: {
          id: row.referred.id,
          name: publicName(row.referred),
          email: row.referred.email,
        },
        reward: row.reward,
      })),
      total,
      page,
      limit,
    );
  }

  async adminDetail(id: string) {
    const row = await this.prisma.referralAttribution.findUnique({
      where: { id },
      include: {
        referrer: { select: USER_LABEL },
        referred: { select: USER_LABEL },
        reward: true,
      },
    });
    if (!row) throw new NotFoundException('Indicação não encontrada.');
    const order = row.reward
      ? await this.prisma.billingOrder.findUnique({
          where: { id: row.reward.orderId },
          include: {
            payments: { orderBy: { createdAt: 'desc' }, take: 1 },
            license: true,
          },
        })
      : null;
    return {
      id: row.id,
      code: row.code,
      stage: row.stage,
      createdAt: row.createdAt.toISOString(),
      referrer: {
        id: row.referrer.id,
        name: publicName(row.referrer),
        email: row.referrer.email,
      },
      referred: {
        id: row.referred.id,
        name: publicName(row.referred),
        email: row.referred.email,
      },
      reward: row.reward
        ? {
            ...row.reward,
            releasedAt: row.reward.releasedAt.toISOString(),
            deliveredAt: row.reward.deliveredAt?.toISOString() ?? null,
            createdAt: row.reward.createdAt.toISOString(),
          }
        : null,
      order: order
        ? {
            id: order.id,
            status: order.status,
            licenseId: order.license?.id ?? null,
            licenseStatus: order.license?.status ?? null,
            paymentId: order.payments[0]?.id ?? null,
            paymentStatus: order.payments[0]?.status ?? null,
          }
        : null,
    };
  }

  async reprocess(actorUserId: string, orderId: string) {
    const result = await this.settlePaidOrder(orderId);
    await this.audit.record({
      actorUserId,
      action: 'referral.reprocess',
      entityType: 'order',
      entityId: orderId,
      summary: 'Reprocessamento idempotente da indicação',
    });
    return result;
  }

  async deliver(actorUserId: string, rewardId: string) {
    const reward = await this.prisma.referralReward.findUnique({
      where: { id: rewardId },
    });
    if (!reward) throw new NotFoundException('Recompensa não encontrada.');
    if (reward.status === 'ON_HOLD') {
      throw new ConflictException('A recompensa está bloqueada para revisão.');
    }
    if (reward.status !== 'PENDING_DELIVERY') {
      throw new ConflictException('A recompensa não está aguardando entrega.');
    }
    if (!reward.ticketId)
      throw new ConflictException('A recompensa não tem chamado de entrega.');
    const eligible = await this.orderStillEligible(reward.orderId);
    if (!eligible)
      throw new ConflictException('A compra não está mais elegível.');
    const updated = await this.prisma.referralReward.updateMany({
      where: { id: reward.id, status: 'PENDING_DELIVERY' },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date(),
        deliveredByUserId: actorUserId,
      },
    });
    if (updated.count !== 1)
      throw new ConflictException('A recompensa já foi atualizada.');
    await this.prisma.ticket.update({
      where: { id: reward.ticketId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedByUserId: actorUserId,
        resolutionNote:
          'Entrega manual de 100 TC declarada pela equipe. O Tibia não foi consultado.',
      },
    });
    await this.audit.record({
      actorUserId,
      action: 'referral.delivered',
      entityType: 'referral_reward',
      entityId: reward.id,
      summary: 'Entrega manual de 100 TC confirmada',
      metadata: { ticketId: reward.ticketId },
    });
    return { delivered: true };
  }

  async hold(actorUserId: string, rewardId: string, reason: string) {
    const text = reason.trim();
    if (text.length < 8)
      throw new BadRequestException('Informe o motivo da revisão.');
    const updated = await this.prisma.referralReward.updateMany({
      where: { id: rewardId, status: 'PENDING_DELIVERY' },
      data: { status: 'ON_HOLD', holdReason: text },
    });
    if (updated.count !== 1)
      throw new ConflictException('A recompensa não pode ser bloqueada.');
    await this.audit.record({
      actorUserId,
      action: 'referral.hold',
      entityType: 'referral_reward',
      entityId: rewardId,
      summary: 'Recompensa bloqueada para revisão',
      metadata: { reason: text },
    });
    return { held: true };
  }

  async release(actorUserId: string, rewardId: string, reason: string) {
    const text = reason.trim();
    if (text.length < 8)
      throw new BadRequestException('Informe o motivo da liberação.');
    const reward = await this.prisma.referralReward.findUnique({
      where: { id: rewardId },
    });
    if (!reward || reward.status !== 'ON_HOLD') {
      throw new ConflictException('A recompensa não está em análise.');
    }
    if (!(await this.orderStillEligible(reward.orderId))) {
      throw new ConflictException('A compra não está mais elegível.');
    }
    await this.prisma.referralReward.update({
      where: { id: reward.id },
      data: {
        status: 'PENDING_DELIVERY',
        holdReason: null,
        reviewReason: text,
      },
    });
    await this.audit.record({
      actorUserId,
      action: 'referral.release',
      entityType: 'referral_reward',
      entityId: reward.id,
      summary: 'Recompensa liberada após revisão',
      metadata: { reason: text },
    });
    return { released: true };
  }

  private async createReward(
    tx: Tx,
    input: {
      attributionId: string;
      referrerUserId: string;
      referredUserId: string;
      referrerName: string;
      referredName: string;
      orderId: string;
      paymentId: string;
      licenseId: string;
    },
  ) {
    const reward = await tx.referralReward.create({
      data: {
        attributionId: input.attributionId,
        referrerUserId: input.referrerUserId,
        referredUserId: input.referredUserId,
        tibiaCoins: REFERRAL_TC,
        orderId: input.orderId,
        paymentId: input.paymentId,
        licenseId: input.licenseId,
      },
    });
    const ticket = await tx.ticket.create({
      data: {
        protocol: createTicketProtocol(),
        authorId: input.referrerUserId,
        status: 'OPEN',
        priority: 'HIGH',
        problemType: 'OTHER',
        impact: 'MEDIUM',
        origin: 'GENERAL',
        description: `[INDICAÇÃO] Entregar 100 TC para ${input.referrerName}. A equipe entrega manualmente no Tibia e confirma no portal. O sistema não consulta o Tibia.`,
      },
    });
    await tx.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: input.referrerUserId,
        visibility: 'INTERNAL',
        body: [
          'Entregar manualmente 100 Tibia Coins.',
          `Indicação: ${input.attributionId}`,
          `Recompensa: ${reward.id}`,
          `Indicador: ${input.referrerName} (${input.referrerUserId})`,
          `Indicado: ${input.referredName} (${input.referredUserId})`,
          `Pedido: ${input.orderId}`,
          `Pagamento: ${input.paymentId}`,
          `Licença: ${input.licenseId}`,
          'Elegível porque o pagamento da compra de licença foi confirmado e a licença está ativa.',
        ].join('\n'),
      },
    });
    await tx.referralReward.update({
      where: { id: reward.id },
      data: { ticketId: ticket.id },
    });
    await tx.referralAttribution.update({
      where: { id: input.attributionId },
      data: { stage: 'REWARDED' },
    });
    await this.audit.record(
      {
        actorUserId: input.referrerUserId,
        action: 'referral.reward',
        entityType: 'referral_reward',
        entityId: reward.id,
        summary: 'Recompensa de 100 TC liberada e chamado aberto',
        metadata: { ticketId: ticket.id, orderId: input.orderId },
      },
      tx,
    );
    return { created: true, rewardId: reward.id, ticketId: ticket.id };
  }

  private async attachTicket(rewardId: string) {
    const reward = await this.prisma.referralReward.findUnique({
      where: { id: rewardId },
      include: {
        referrer: { select: USER_LABEL },
        attribution: { include: { referred: { select: USER_LABEL } } },
      },
    });
    if (!reward || reward.ticketId) return;
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.referralReward.findUnique({
        where: { id: rewardId },
      });
      if (!current || current.ticketId) return;
      const ticket = await tx.ticket.create({
        data: {
          protocol: createTicketProtocol(),
          authorId: current.referrerUserId,
          status: 'OPEN',
          priority: 'HIGH',
          problemType: 'OTHER',
          impact: 'MEDIUM',
          origin: 'GENERAL',
          description: `[INDICAÇÃO] Entregar 100 TC para ${publicName(reward.referrer)}. A equipe entrega manualmente no Tibia e confirma no portal.`,
        },
      });
      const linked = await tx.referralReward.updateMany({
        where: { id: current.id, ticketId: null },
        data: { ticketId: ticket.id },
      });
      if (linked.count !== 1) {
        await tx.ticket.delete({ where: { id: ticket.id } });
        return;
      }
      await this.audit.record(
        {
          actorUserId: current.referrerUserId,
          action: 'referral.ticket_recovered',
          entityType: 'referral_reward',
          entityId: current.id,
          summary: 'Chamado de entrega recuperado sem nova recompensa',
          metadata: { ticketId: ticket.id },
        },
        tx,
      );
    });
  }

  private async orderStillEligible(orderId: string) {
    const order = await this.prisma.billingOrder.findUnique({
      where: { id: orderId },
      include: {
        license: true,
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    return Boolean(
      order &&
      order.status === 'PAID' &&
      order.license &&
      order.license.source === 'PURCHASE' &&
      licenseGrantsAccess(order.license) &&
      order.payments[0]?.status === 'PAID',
    );
  }

  private async note(
    reward: { id: string; ticketId: string | null; referrerUserId: string },
    body: string,
  ) {
    if (!reward.ticketId) return;
    await this.prisma.ticketMessage.create({
      data: {
        ticketId: reward.ticketId,
        authorId: reward.referrerUserId,
        visibility: 'INTERNAL',
        body,
      },
    });
  }

  private generateCode() {
    const bytes = randomBytes(8);
    let body = '';
    for (const value of bytes) body += ALPHABET[value % ALPHABET.length];
    return `R${body}`;
  }
}

export { ForbiddenException };
