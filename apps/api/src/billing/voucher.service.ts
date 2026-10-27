import { BadRequestException, Injectable } from '@nestjs/common';
import { AdminAuditService } from '../audit/admin-audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { activeUserProductKey } from './billing.constants';
import { BillingService } from './billing.service';
import { effectiveVoucherStatus, licenseGrantsAccess } from './license-access';
import { hashVoucherCode } from './voucher-code';

const REDEEM_ERROR = 'Código inválido ou indisponível';

const REJECT_MESSAGES: Record<string, string> = {
  PAUSED: 'Este voucher está pausado e não pode ser resgatado.',
  CLOSED: 'Este voucher foi encerrado.',
  EXPIRED: 'Este voucher expirou.',
  EXHAUSTED: 'Este voucher esgotou as utilizações disponíveis.',
  SCHEDULED: 'Este voucher ainda não está disponível.',
  USER_LIMIT: 'Você já utilizou este voucher nesta conta.',
  ALREADY_LICENSED: 'Sua conta já possui Premium ativo ou suspenso.',
};

@Injectable()
export class VoucherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly audit: AdminAuditService,
  ) {}

  async redeem(userId: string, rawCode: string) {
    const codeHash = hashVoucherCode(rawCode);
    const outcome = await this.prisma.$transaction(async (tx) => {
      const voucher = await tx.billingVoucher.findUnique({
        where: { codeHash },
      });
      if (!voucher) {
        return { kind: 'missing' as const };
      }

      const effective = effectiveVoucherStatus(voucher);
      if (effective !== 'ACTIVE') {
        await tx.billingVoucherRedemption.create({
          data: {
            voucherId: voucher.id,
            userId,
            result: 'REJECTED',
            reason: effective,
          },
        });
        return { kind: 'rejected' as const, reason: effective };
      }

      const used = await tx.billingVoucherRedemption.count({
        where: { voucherId: voucher.id, userId, result: 'SUCCESS' },
      });
      if (used >= voucher.perUserLimit) {
        await tx.billingVoucherRedemption.create({
          data: {
            voucherId: voucher.id,
            userId,
            result: 'REJECTED',
            reason: 'USER_LIMIT',
          },
        });
        return { kind: 'rejected' as const, reason: 'USER_LIMIT' };
      }

      const existing = await tx.billingLicense.findFirst({
        where: {
          userId,
          productId: voucher.productId,
          status: 'ACTIVE',
        },
      });
      const suspended = await tx.billingLicense.findFirst({
        where: {
          userId,
          productId: voucher.productId,
          status: 'SUSPENDED',
        },
      });
      if ((existing && licenseGrantsAccess(existing)) || suspended) {
        await tx.billingVoucherRedemption.create({
          data: {
            voucherId: voucher.id,
            userId,
            result: 'REJECTED',
            reason: 'ALREADY_LICENSED',
          },
        });
        return { kind: 'rejected' as const, reason: 'ALREADY_LICENSED' };
      }
      if (existing?.status === 'ACTIVE') {
        await tx.billingLicense.updateMany({
          where: { id: existing.id, status: 'ACTIVE' },
          data: { status: 'EXPIRED', activeUserProductKey: null },
        });
      }

      const taken = await tx.billingVoucher.updateMany({
        where: {
          id: voucher.id,
          status: 'ACTIVE',
          redeemedCount: { lt: voucher.maxRedemptions },
        },
        data: { redeemedCount: { increment: 1 } },
      });
      if (taken.count !== 1) {
        await tx.billingVoucherRedemption.create({
          data: {
            voucherId: voucher.id,
            userId,
            result: 'REJECTED',
            reason: 'EXHAUSTED',
          },
        });
        return { kind: 'rejected' as const, reason: 'EXHAUSTED' };
      }

      const fresh = await tx.billingVoucher.findUnique({
        where: { id: voucher.id },
      });
      if (fresh && fresh.redeemedCount >= fresh.maxRedemptions) {
        await tx.billingVoucher.updateMany({
          where: { id: voucher.id, status: 'ACTIVE' },
          data: { status: 'EXHAUSTED' },
        });
      }

      const expiresAt =
        voucher.term === 'FIXED' && voucher.durationDays
          ? new Date(Date.now() + voucher.durationDays * 86_400_000)
          : null;
      const license = await tx.billingLicense.create({
        data: {
          userId,
          productId: voucher.productId,
          source: voucher.benefit === 'PARTNERSHIP' ? 'PARTNERSHIP' : 'VOUCHER',
          term: voucher.term,
          expiresAt,
          status: 'ACTIVE',
          activeUserProductKey: activeUserProductKey(userId, voucher.productId),
        },
      });
      await tx.billingVoucherRedemption.create({
        data: {
          voucherId: voucher.id,
          userId,
          result: 'SUCCESS',
          licenseId: license.id,
        },
      });
      await this.audit.record(
        {
          actorUserId: userId,
          action: 'voucher.redeem',
          entityType: 'voucher',
          entityId: voucher.id,
          summary: 'Resgate de voucher',
          metadata: { licenseId: license.id, benefit: voucher.benefit },
        },
        tx,
      );
      return { kind: 'ok' as const };
    });

    if (outcome.kind === 'missing') {
      throw new BadRequestException(REDEEM_ERROR);
    }
    if (outcome.kind === 'rejected') {
      throw new BadRequestException(
        REJECT_MESSAGES[outcome.reason] ?? REDEEM_ERROR,
      );
    }
    return this.billing.getPremium(userId);
  }
}
