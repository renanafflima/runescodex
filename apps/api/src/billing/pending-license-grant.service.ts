import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminAuditService } from '../audit/admin-audit.service';
import { pageResult, resolvePage } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { PREMIUM_PRODUCT_CODE, activeUserProductKey } from './billing.constants';
import { licenseGrantsAccess } from './license-access';

const DAY_MS = 86_400_000;
const DEFAULT_OFFER_DAYS = 90;

type GrantCategory =
  | 'COLLABORATOR'
  | 'PARTNERSHIP'
  | 'CONTENT_CREATOR'
  | 'COMPENSATION'
  | 'OTHER';

type GrantTerm = 'LIFETIME' | 'FIXED';

export type SchedulePendingGrantInput = {
  email: string;
  term: GrantTerm;
  durationDays?: number;
  category: GrantCategory;
  reason: string;
  offerExpiresAt?: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function requireReason(reason: string) {
  const text = reason.trim();
  if (text.length < 8) {
    throw new BadRequestException('A justificativa é obrigatória');
  }
  return text;
}

function sourceForGrant(category: GrantCategory) {
  if (category === 'PARTNERSHIP') return 'PARTNERSHIP' as const;
  if (category === 'COMPENSATION') return 'COMPENSATION' as const;
  return 'ADMIN_GRANT' as const;
}

@Injectable()
export class PendingLicenseGrantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async schedule(actorUserId: string, input: SchedulePendingGrantInput) {
    const reason = requireReason(input.reason);
    if (input.term === 'FIXED' && !input.durationDays) {
      throw new BadRequestException('Informe a duração da licença');
    }
    if (input.term === 'LIFETIME' && input.durationDays) {
      throw new BadRequestException('Licença vitalícia não tem duração');
    }
    const email = normalizeEmail(input.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Informe um e-mail válido');
    }
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException(
        'Já existe uma conta com este e-mail. Conceda a licença pela conta existente.',
      );
    }
    const product = await this.premiumProduct();
    const offerExpiresAt = input.offerExpiresAt
      ? new Date(input.offerExpiresAt)
      : new Date(Date.now() + DEFAULT_OFFER_DAYS * DAY_MS);
    if (offerExpiresAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        'A validade da oferta precisa ser futura',
      );
    }
    const duplicate = await this.prisma.billingPendingLicenseGrant.findFirst({
      where: {
        emailNormalized: email,
        productId: product.id,
        status: 'PENDING',
      },
    });
    if (duplicate) {
      throw new ConflictException(
        'Já existe uma concessão pendente para este e-mail',
      );
    }
    try {
      const row = await this.prisma.billingPendingLicenseGrant.create({
        data: {
          emailNormalized: email,
          productId: product.id,
          actorUserId,
          category: input.category,
          reason,
          term: input.term,
          durationDays: input.term === 'FIXED' ? input.durationDays : null,
          offerExpiresAt,
          status: 'PENDING',
        },
      });
      await this.audit.record({
        actorUserId,
        action: 'license.pending_grant',
        entityType: 'pending_license_grant',
        entityId: row.id,
        summary: 'Concessão pendente registrada para e-mail sem conta',
        metadata: { category: input.category, term: input.term },
      });
      return this.present(row);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        throw new ConflictException(
          'Já existe uma concessão pendente para este e-mail',
        );
      }
      throw error;
    }
  }

  async list(query: {
    page?: number;
    limit?: number;
    status?: 'PENDING' | 'CLAIMED' | 'CANCELLED' | 'EXPIRED';
  }) {
    const { page, limit, skip } = resolvePage(query);
    const status =
      query.status === 'PENDING' ||
      query.status === 'CLAIMED' ||
      query.status === 'CANCELLED' ||
      query.status === 'EXPIRED'
        ? query.status
        : undefined;
    const where = status ? { status } : {};
    const [total, rows] = await Promise.all([
      this.prisma.billingPendingLicenseGrant.count({ where }),
      this.prisma.billingPendingLicenseGrant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    return pageResult(
      rows.map((row) => this.present(row)),
      total,
      page,
      limit,
    );
  }

  async cancel(actorUserId: string, id: string, reason: string) {
    const text = requireReason(reason);
    const updated = await this.prisma.billingPendingLicenseGrant.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: text,
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException('A oferta pendente não pode ser cancelada');
    }
    await this.audit.record({
      actorUserId,
      action: 'license.pending_cancel',
      entityType: 'pending_license_grant',
      entityId: id,
      summary: 'Concessão pendente cancelada',
      metadata: { reason: text },
    });
    const row = await this.prisma.billingPendingLicenseGrant.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Concessão pendente não encontrada');
    return this.present(row);
  }

  /**
   * Activates pending offers only after the caller authenticated as this email.
   * Typing an email in the admin UI never creates a license by itself.
   */
  async claimForAuthenticatedUser(userId: string, email: string) {
    const normalized = normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user || normalizeEmail(user.email) !== normalized) {
      return { claimed: 0 };
    }
    const now = new Date();
    await this.prisma.billingPendingLicenseGrant.updateMany({
      where: {
        emailNormalized: normalized,
        status: 'PENDING',
        offerExpiresAt: { lte: now },
      },
      data: { status: 'EXPIRED' },
    });
    const pending = await this.prisma.billingPendingLicenseGrant.findMany({
      where: {
        emailNormalized: normalized,
        status: 'PENDING',
        OR: [{ offerExpiresAt: null }, { offerExpiresAt: { gt: now } }],
      },
      orderBy: { createdAt: 'asc' },
    });
    let claimed = 0;
    for (const offer of pending) {
      const ok = await this.claimOne(userId, offer);
      if (ok) claimed += 1;
    }
    return { claimed };
  }

  private async claimOne(
    userId: string,
    offer: {
      id: string;
      productId: string;
      actorUserId: string;
      category: GrantCategory;
      reason: string;
      term: GrantTerm;
      durationDays: number | null;
    },
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const locked = await tx.billingPendingLicenseGrant.findUnique({
          where: { id: offer.id },
        });
        if (!locked || locked.status !== 'PENDING') return false;

        const active = await tx.billingLicense.findFirst({
          where: {
            userId,
            productId: offer.productId,
            status: { in: ['ACTIVE', 'SUSPENDED'] },
          },
        });
        if (active && (active.status === 'SUSPENDED' || licenseGrantsAccess(active))) {
          await tx.billingPendingLicenseGrant.updateMany({
            where: { id: offer.id, status: 'PENDING' },
            data: {
              status: 'CANCELLED',
              cancelledAt: new Date(),
              cancelReason: 'Conta já possui licença ativa ou suspensa',
            },
          });
          return false;
        }
        if (active?.status === 'ACTIVE') {
          await tx.billingLicense.updateMany({
            where: { id: active.id, status: 'ACTIVE' },
            data: { status: 'EXPIRED', activeUserProductKey: null },
          });
        }

        const expiresAt =
          offer.term === 'FIXED' && offer.durationDays
            ? new Date(Date.now() + offer.durationDays * DAY_MS)
            : null;
        const license = await tx.billingLicense.create({
          data: {
            userId,
            productId: offer.productId,
            source: sourceForGrant(offer.category),
            term: offer.term,
            expiresAt,
            status: 'ACTIVE',
            reason: offer.reason,
            grantedByUserId: offer.actorUserId,
            activeUserProductKey: activeUserProductKey(userId, offer.productId),
          },
        });
        await tx.billingLicenseGrant.create({
          data: {
            userId,
            actorUserId: offer.actorUserId,
            category: offer.category,
            reason: offer.reason,
            term: offer.term,
            expiresAt,
            licenseId: license.id,
          },
        });
        const linked = await tx.billingPendingLicenseGrant.updateMany({
          where: { id: offer.id, status: 'PENDING' },
          data: {
            status: 'CLAIMED',
            claimedUserId: userId,
            claimedLicenseId: license.id,
            claimedAt: new Date(),
          },
        });
        if (linked.count !== 1) {
          throw new ConflictException('Concessão pendente já foi reivindicada');
        }
        await this.audit.record(
          {
            actorUserId: userId,
            action: 'license.pending_claim',
            entityType: 'pending_license_grant',
            entityId: offer.id,
            summary: 'Concessão pendente vinculada após autenticação do e-mail',
            metadata: { licenseId: license.id },
          },
          tx,
        );
        return true;
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        return false;
      }
      throw error;
    }
  }

  private present(row: {
    id: string;
    emailNormalized: string;
    category: string;
    reason: string;
    term: string;
    durationDays: number | null;
    status: string;
    offerExpiresAt: Date | null;
    claimedUserId: string | null;
    claimedLicenseId: string | null;
    claimedAt: Date | null;
    cancelledAt: Date | null;
    cancelReason: string | null;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      email: row.emailNormalized,
      category: row.category,
      reason: row.reason,
      term: row.term,
      durationDays: row.durationDays,
      status: row.status,
      offerExpiresAt: row.offerExpiresAt?.toISOString() ?? null,
      claimedUserId: row.claimedUserId,
      claimedLicenseId: row.claimedLicenseId,
      claimedAt: row.claimedAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      cancelReason: row.cancelReason,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async premiumProduct() {
    const product = await this.prisma.billingProduct.findUnique({
      where: { code: PREMIUM_PRODUCT_CODE },
    });
    if (!product?.active) {
      throw new BadRequestException('Produto Premium indisponível');
    }
    return product;
  }
}
