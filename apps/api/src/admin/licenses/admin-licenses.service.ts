import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminAuditService } from '../../audit/admin-audit.service';
import { BillingCheckoutService } from '../../billing/billing-checkout.service';
import {
  MERCADO_PAGO_PROVIDER,
  PREMIUM_PRODUCT_CODE,
  activeUserProductKey,
} from '../../billing/billing.constants';
import {
  effectiveLicenseStatus,
  effectiveVoucherStatus,
  licenseGrantsAccess,
} from '../../billing/license-access';
import {
  generateVoucherCode,
  hashVoucherCode,
  voucherPrefix,
} from '../../billing/voucher-code';
import { pageResult, resolvePage } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateVoucherDto,
  ExtendLicenseDto,
  GrantLicenseDto,
  LicenseReasonDto,
  ListGrantsQueryDto,
  ListLicensesQueryDto,
  ListPaymentsQueryDto,
  ListVouchersQueryDto,
} from './admin-licenses.dto';

const DAY_MS = 86_400_000;
const ACTIVITY_ACTIONS = [
  'license.grant',
  'license.extend',
  'license.suspend',
  'license.revoke',
  'license.restore',
  'license.pending_grant',
  'license.pending_cancel',
  'license.pending_claim',
  'voucher.create',
  'voucher.pause',
  'voucher.resume',
  'voucher.close',
  'voucher.redeem',
  'payment.status',
  'payment.sync',
];

type GrantCategory = GrantLicenseDto['category'];

function sourceForGrant(category: GrantCategory) {
  if (category === 'PARTNERSHIP') return 'PARTNERSHIP' as const;
  if (category === 'COMPENSATION') return 'COMPENSATION' as const;
  return 'ADMIN_GRANT' as const;
}

function requireReason(reason: string) {
  const text = reason.trim();
  if (text.length < 8) {
    throw new BadRequestException('A justificativa é obrigatória');
  }
  return text;
}

function userName(user: {
  email: string;
  activeCharacter: { name: string } | null;
}) {
  return user.activeCharacter?.name ?? user.email;
}

@Injectable()
export class AdminLicensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
    private readonly checkout: BillingCheckoutService,
  ) {}

  async overview() {
    const now = new Date();
    const current = {
      status: 'ACTIVE' as const,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };
    const [
      activeLicenses,
      lifetimeLicenses,
      fixedLicenses,
      grantedLicenses,
      purchasedLicenses,
      voucherLicenses,
      partnershipLicenses,
      activeVouchers,
      redemptions,
      paymentGroups,
    ] = await Promise.all([
      this.prisma.billingLicense.count({ where: current }),
      this.prisma.billingLicense.count({
        where: { ...current, term: 'LIFETIME' },
      }),
      this.prisma.billingLicense.count({
        where: { ...current, term: 'FIXED' },
      }),
      this.prisma.billingLicense.count({
        where: {
          ...current,
          source: { in: ['ADMIN_GRANT', 'PARTNERSHIP', 'COMPENSATION'] },
        },
      }),
      this.prisma.billingLicense.count({
        where: { source: 'PURCHASE' },
      }),
      this.prisma.billingLicense.count({ where: { source: 'VOUCHER' } }),
      this.prisma.billingLicense.count({ where: { source: 'PARTNERSHIP' } }),
      this.prisma.billingVoucher.count({
        where: {
          status: 'ACTIVE',
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
      }),
      this.prisma.billingVoucherRedemption.count({
        where: { result: 'SUCCESS' },
      }),
      this.prisma.billingPayment.groupBy({
        by: ['status', 'currency'],
        _count: { _all: true },
        _sum: { amountMinor: true },
      }),
    ]);

    const amounts = (status: 'PAID' | 'PENDING' | 'FAILED' | 'REFUNDED') =>
      paymentGroups
        .filter((row) => row.status === status)
        .map((row) => ({
          currency: row.currency,
          count: row._count._all,
          amountMinor: row._sum.amountMinor ?? 0,
        }));

    return {
      activeLicenses,
      lifetimeLicenses,
      fixedLicenses,
      grantedLicenses,
      purchasedLicenses,
      voucherLicenses,
      partnershipLicenses,
      activeVouchers,
      redemptions,
      approvedPayments: amounts('PAID'),
      pendingPayments: amounts('PENDING'),
      rejectedPayments: amounts('FAILED'),
      refundedPayments: amounts('REFUNDED'),
      commercialDiscount: {
        available: false,
        reason:
          'Desconto comercial no checkout não está integrado ao Mercado Pago.',
      },
    };
  }

  async list(query: ListLicensesQueryDto) {
    const { page, limit, skip } = resolvePage(query);
    const now = new Date();
    const search = query.search?.trim();
    const where = {
      ...(query.term ? { term: query.term } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.status === 'ACTIVE'
        ? {
            status: 'ACTIVE' as const,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          }
        : {}),
      ...(query.status === 'EXPIRED'
        ? {
            OR: [
              { status: 'EXPIRED' as const },
              { status: 'ACTIVE' as const, expiresAt: { lte: now } },
            ],
          }
        : {}),
      ...(query.status === 'SUSPENDED' || query.status === 'REVOKED'
        ? { status: query.status }
        : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lt: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            user: {
              OR: [
                { email: { contains: search, mode: 'insensitive' as const } },
                { id: search },
                {
                  activeCharacter: {
                    name: { contains: search, mode: 'insensitive' as const },
                  },
                },
              ],
            },
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.billingLicense.count({ where }),
      this.prisma.billingLicense.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              activeCharacter: { select: { name: true } },
            },
          },
          product: { select: { code: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    return pageResult(
      rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        userName: userName(row.user),
        email: row.user.email,
        product: row.product.code,
        source: row.source,
        term: row.term,
        status: effectiveLicenseStatus(row),
        storedStatus: row.status,
        activatedAt: row.grantedAt.toISOString(),
        expiresAt: row.expiresAt?.toISOString() ?? null,
      })),
      total,
      page,
      limit,
    );
  }

  async detail(id: string) {
    const license = await this.prisma.billingLicense.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            activeCharacter: { select: { name: true } },
          },
        },
        product: { select: { code: true, name: true } },
        order: {
          include: {
            payments: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
        grant: {
          include: {
            actor: {
              select: {
                id: true,
                activeCharacter: { select: { name: true } },
                email: true,
              },
            },
          },
        },
        redemption: {
          select: { id: true, voucherId: true, createdAt: true, result: true },
        },
      },
    });
    if (!license) {
      throw new NotFoundException('Licença não encontrada');
    }
    const events = await this.prisma.adminAuditEvent.findMany({
      where: {
        OR: [
          { entityType: 'license', entityId: license.id },
          ...(license.grant
            ? [{ entityType: 'grant', entityId: license.grant.id }]
            : []),
          ...(license.order
            ? license.order.payments.map((payment) => ({
                entityType: 'payment',
                entityId: payment.id,
              }))
            : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        action: true,
        summary: true,
        createdAt: true,
        actorUserId: true,
      },
    });
    return {
      id: license.id,
      userId: license.userId,
      userName: userName(license.user),
      email: license.user.email,
      product: license.product.code,
      source: license.source,
      term: license.term,
      status: effectiveLicenseStatus(license),
      storedStatus: license.status,
      activatedAt: license.grantedAt.toISOString(),
      expiresAt: license.expiresAt?.toISOString() ?? null,
      reason: license.reason,
      orderId: license.orderId,
      payments:
        license.order?.payments.map((payment) => ({
          id: payment.id,
          providerPaymentId: payment.providerPaymentId,
          status: payment.status,
          providerStatus: payment.providerStatus,
          currency: payment.currency,
          amountMinor: payment.amountMinor,
          createdAt: payment.createdAt.toISOString(),
        })) ?? [],
      grant: license.grant
        ? {
            id: license.grant.id,
            category: license.grant.category,
            reason: license.grant.reason,
            actorName: userName(license.grant.actor),
            revokedAt: license.grant.revokedAt?.toISOString() ?? null,
          }
        : null,
      redemption: license.redemption
        ? {
            id: license.redemption.id,
            voucherId: license.redemption.voucherId,
            at: license.redemption.createdAt.toISOString(),
          }
        : null,
      events: events.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }

  async searchUsers(search: string) {
    const term = search.trim();
    const rows = await this.prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: term, mode: 'insensitive' } },
          { id: term },
          {
            activeCharacter: {
              name: { contains: term, mode: 'insensitive' },
            },
          },
        ],
      },
      select: {
        id: true,
        email: true,
        activeCharacter: { select: { name: true } },
      },
      take: 8,
    });
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.activeCharacter?.name ?? null,
    }));
  }

  async grant(actorUserId: string, dto: GrantLicenseDto) {
    const reason = requireReason(dto.reason);
    if (dto.term === 'FIXED' && !dto.durationDays) {
      throw new BadRequestException('Informe a duração da licença');
    }
    const product = await this.premiumProduct();
    const beneficiary = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true },
    });
    if (!beneficiary) {
      throw new NotFoundException('Usuário não encontrado');
    }
    const expiresAt =
      dto.term === 'FIXED' && dto.durationDays
        ? new Date(Date.now() + dto.durationDays * DAY_MS)
        : null;
    const license = await this.prisma.$transaction(async (tx) => {
      await this.assertNoCurrentLicense(tx, dto.userId, product.id);
      const created = await tx.billingLicense.create({
        data: {
          userId: dto.userId,
          productId: product.id,
          source: sourceForGrant(dto.category),
          term: dto.term,
          expiresAt,
          status: 'ACTIVE',
          reason,
          grantedByUserId: actorUserId,
          activeUserProductKey: activeUserProductKey(dto.userId, product.id),
        },
      });
      const grant = await tx.billingLicenseGrant.create({
        data: {
          userId: dto.userId,
          actorUserId,
          category: dto.category,
          reason,
          term: dto.term,
          expiresAt,
          licenseId: created.id,
        },
      });
      await this.audit.record(
        {
          actorUserId,
          action: 'license.grant',
          entityType: 'license',
          entityId: created.id,
          summary: 'Concessão administrativa de licença',
          metadata: { category: dto.category, grantId: grant.id },
        },
        tx,
      );
      return created;
    });
    return this.detail(license.id);
  }

  async listGrants(query: ListGrantsQueryDto) {
    const { page, limit, skip } = resolvePage(query);
    const where = query.userId ? { userId: query.userId } : {};
    const [total, rows] = await Promise.all([
      this.prisma.billingLicenseGrant.count({ where }),
      this.prisma.billingLicenseGrant.findMany({
        where,
        include: {
          user: {
            select: {
              email: true,
              activeCharacter: { select: { name: true } },
            },
          },
          license: { select: { status: true, expiresAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    return pageResult(
      rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        userName: userName(row.user),
        email: row.user.email,
        category: row.category,
        term: row.term,
        reason: row.reason,
        licenseId: row.licenseId,
        licenseStatus: effectiveLicenseStatus(row.license),
        startsAt: row.startsAt.toISOString(),
        expiresAt: row.expiresAt?.toISOString() ?? null,
        revokedAt: row.revokedAt?.toISOString() ?? null,
      })),
      total,
      page,
      limit,
    );
  }

  async extend(actorUserId: string, id: string, dto: ExtendLicenseDto) {
    const reason = requireReason(dto.reason);
    await this.prisma.$transaction(async (tx) => {
      const license = await this.requireLicense(tx, id);
      if (license.term !== 'FIXED') {
        throw new BadRequestException(
          'Somente licenças com validade podem ser estendidas',
        );
      }
      if (license.status !== 'ACTIVE' && license.status !== 'SUSPENDED') {
        throw new BadRequestException('Esta licença não pode ser estendida');
      }
      const now = new Date();
      const base =
        license.expiresAt && license.expiresAt.getTime() > now.getTime()
          ? license.expiresAt
          : now;
      await tx.billingLicense.update({
        where: { id },
        data: {
          expiresAt: new Date(base.getTime() + dto.durationDays * DAY_MS),
          reason,
        },
      });
      await this.audit.record(
        {
          actorUserId,
          action: 'license.extend',
          entityType: 'license',
          entityId: id,
          summary: 'Extensão de validade',
          metadata: { durationDays: dto.durationDays },
        },
        tx,
      );
    });
    return this.detail(id);
  }

  async suspend(actorUserId: string, id: string, dto: LicenseReasonDto) {
    const reason = requireReason(dto.reason);
    await this.prisma.$transaction(async (tx) => {
      const license = await this.requireLicense(tx, id);
      if (!licenseGrantsAccess(license)) {
        throw new BadRequestException(
          'Somente uma licença ativa pode ser suspensa',
        );
      }
      await tx.billingLicense.update({
        where: { id },
        data: { status: 'SUSPENDED', suspendedAt: new Date(), reason },
      });
      await this.audit.record(
        {
          actorUserId,
          action: 'license.suspend',
          entityType: 'license',
          entityId: id,
          summary: 'Suspensão de licença',
        },
        tx,
      );
    });
    return this.detail(id);
  }

  async revoke(actorUserId: string, id: string, dto: LicenseReasonDto) {
    const reason = requireReason(dto.reason);
    await this.prisma.$transaction(async (tx) => {
      const license = await this.requireLicense(tx, id);
      if (license.status === 'REVOKED' || license.status === 'EXPIRED') {
        throw new BadRequestException('Esta licença não pode ser revogada');
      }
      await tx.billingLicense.update({
        where: { id },
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
          activeUserProductKey: null,
          reason,
        },
      });
      await tx.billingLicenseGrant.updateMany({
        where: { licenseId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: reason },
      });
      await this.audit.record(
        {
          actorUserId,
          action: 'license.revoke',
          entityType: 'license',
          entityId: id,
          summary: 'Revogação de licença',
        },
        tx,
      );
    });
    return this.detail(id);
  }

  async restore(actorUserId: string, id: string, dto: LicenseReasonDto) {
    const reason = requireReason(dto.reason);
    await this.prisma.$transaction(async (tx) => {
      const license = await this.requireLicense(tx, id);
      if (license.status !== 'SUSPENDED') {
        throw new BadRequestException(
          'Somente uma licença suspensa pode ser restaurada',
        );
      }
      if (license.expiresAt && license.expiresAt.getTime() <= Date.now()) {
        throw new BadRequestException('A licença suspensa já expirou');
      }
      await tx.billingLicense.update({
        where: { id },
        data: { status: 'ACTIVE', suspendedAt: null, reason },
      });
      await this.audit.record(
        {
          actorUserId,
          action: 'license.restore',
          entityType: 'license',
          entityId: id,
          summary: 'Restauração de licença',
        },
        tx,
      );
    });
    return this.detail(id);
  }

  async listPayments(query: ListPaymentsQueryDto) {
    const { page, limit, skip } = resolvePage(query);
    const search = query.search?.trim();
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.currency ? { currency: query.currency } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lt: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { providerPaymentId: search },
              { id: search },
              {
                order: {
                  user: {
                    OR: [
                      {
                        email: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                      { id: search },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.billingPayment.count({ where }),
      this.prisma.billingPayment.findMany({
        where,
        include: {
          order: {
            select: {
              product: { select: { code: true } },
              license: { select: { id: true } },
              user: {
                select: {
                  id: true,
                  email: true,
                  activeCharacter: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    return pageResult(
      rows.map((row) => this.paymentView(row)),
      total,
      page,
      limit,
    );
  }

  async paymentDetail(id: string) {
    const payment = await this.prisma.billingPayment.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            product: { select: { code: true } },
            license: { select: { id: true, status: true } },
            user: {
              select: {
                id: true,
                email: true,
                activeCharacter: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    if (!payment) {
      throw new NotFoundException('Pagamento não encontrado');
    }
    const events = await this.prisma.billingEventReceipt.findMany({
      where: { paymentId: payment.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, type: true, provider: true, createdAt: true },
    });
    return {
      ...this.paymentView(payment),
      events: events.map((event) => ({
        id: event.id,
        type: event.type,
        provider: event.provider,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }

  async syncPayment(actorUserId: string, id: string) {
    const payment = await this.prisma.billingPayment.findUnique({
      where: { id },
    });
    if (!payment?.providerPaymentId) {
      throw new BadRequestException(
        'Este pagamento não pode ser sincronizado com o Mercado Pago',
      );
    }
    if (payment.provider !== MERCADO_PAGO_PROVIDER) {
      throw new BadRequestException(
        'Este pagamento não pode ser sincronizado com o Mercado Pago',
      );
    }
    const remote = await this.checkout.reconcileProviderPayment(
      payment.providerPaymentId,
    );
    await this.prisma.billingPayment.update({
      where: { id },
      data: {
        syncedAt: new Date(),
        providerStatus: remote.providerStatus.slice(0, 40),
      },
    });
    await this.audit.record({
      actorUserId,
      action: 'payment.sync',
      entityType: 'payment',
      entityId: id,
      summary: 'Sincronização administrativa do pagamento',
      metadata: { providerStatus: remote.providerStatus },
    });
    return this.paymentDetail(id);
  }

  async createVoucher(actorUserId: string, dto: CreateVoucherDto) {
    if (dto.term === 'FIXED' && !dto.durationDays) {
      throw new BadRequestException('Informe a duração da licença');
    }
    if (dto.term === 'LIFETIME' && dto.durationDays) {
      throw new BadRequestException('Licença vitalícia não tem duração');
    }
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date();
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException(
        'O término precisa ser posterior ao início',
      );
    }
    const product = await this.premiumProduct();
    const code = generateVoucherCode();
    const voucher = await this.prisma.billingVoucher.create({
      data: {
        codeHash: hashVoucherCode(code),
        codePrefix: voucherPrefix(code),
        benefit: dto.benefit,
        productId: product.id,
        term: dto.term,
        durationDays: dto.term === 'FIXED' ? dto.durationDays : null,
        maxRedemptions: dto.maxRedemptions,
        perUserLimit: dto.perUserLimit,
        startsAt,
        endsAt,
        campaign: dto.campaign?.trim() || null,
        notes: dto.notes?.trim() || null,
        createdByUserId: actorUserId,
      },
    });
    await this.audit.record({
      actorUserId,
      action: 'voucher.create',
      entityType: 'voucher',
      entityId: voucher.id,
      summary: 'Criação de voucher',
      metadata: { benefit: dto.benefit, prefix: voucher.codePrefix },
    });
    return { ...this.voucherView(voucher), code };
  }

  async listVouchers(query: ListVouchersQueryDto) {
    const { page, limit, skip } = resolvePage(query);
    const search = query.search?.trim();
    const rows = await this.prisma.billingVoucher.findMany({
      where: search
        ? {
            OR: [
              { codePrefix: { startsWith: search.slice(0, 7).toUpperCase() } },
              { campaign: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {},
      orderBy: { createdAt: 'desc' },
    });
    const visible = query.status
      ? rows.filter((row) => effectiveVoucherStatus(row) === query.status)
      : rows;
    const pageRows = visible.slice(skip, skip + limit);
    return pageResult(
      pageRows.map((row) => this.voucherView(row)),
      visible.length,
      page,
      limit,
    );
  }

  async voucherDetail(id: string) {
    const voucher = await this.prisma.billingVoucher.findUnique({
      where: { id },
      include: {
        redemptions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                activeCharacter: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    if (!voucher) {
      throw new NotFoundException('Voucher não encontrado');
    }
    return {
      ...this.voucherView(voucher),
      notes: voucher.notes,
      redemptions: voucher.redemptions.map((row) => ({
        id: row.id,
        userId: row.userId,
        userName: userName(row.user),
        email: row.user.email,
        result: row.result,
        reason: row.reason,
        licenseId: row.licenseId,
        at: row.createdAt.toISOString(),
      })),
    };
  }

  async pauseVoucher(actorUserId: string, id: string) {
    return this.setVoucherStatus(
      actorUserId,
      id,
      'PAUSED',
      ['ACTIVE'],
      'voucher.pause',
    );
  }

  async resumeVoucher(actorUserId: string, id: string) {
    return this.setVoucherStatus(
      actorUserId,
      id,
      'ACTIVE',
      ['PAUSED'],
      'voucher.resume',
    );
  }

  async closeVoucher(actorUserId: string, id: string) {
    return this.setVoucherStatus(
      actorUserId,
      id,
      'CLOSED',
      ['ACTIVE', 'PAUSED'],
      'voucher.close',
    );
  }

  async activity() {
    const rows = await this.prisma.adminAuditEvent.findMany({
      where: { action: { in: ACTIVITY_ACTIONS } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        summary: true,
        createdAt: true,
      },
    });
    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private async setVoucherStatus(
    actorUserId: string,
    id: string,
    status: 'ACTIVE' | 'PAUSED' | 'CLOSED',
    from: Array<'ACTIVE' | 'PAUSED'>,
    action: string,
  ) {
    const voucher = await this.prisma.billingVoucher.findUnique({
      where: { id },
    });
    if (!voucher) {
      throw new NotFoundException('Voucher não encontrado');
    }
    if (!from.includes(voucher.status as 'ACTIVE' | 'PAUSED')) {
      throw new BadRequestException('Este voucher não pode mudar de estado');
    }
    if (
      status === 'ACTIVE' &&
      voucher.redeemedCount >= voucher.maxRedemptions
    ) {
      throw new BadRequestException('O voucher está esgotado');
    }
    await this.prisma.billingVoucher.update({
      where: { id },
      data: { status },
    });
    await this.audit.record({
      actorUserId,
      action,
      entityType: 'voucher',
      entityId: id,
      summary: 'Alteração de voucher',
      metadata: { status },
    });
    return this.voucherDetail(id);
  }

  private voucherView(voucher: {
    id: string;
    codePrefix: string;
    benefit: string;
    term: string;
    durationDays: number | null;
    maxRedemptions: number;
    redeemedCount: number;
    perUserLimit: number;
    startsAt: Date;
    endsAt: Date | null;
    status: string;
    campaign: string | null;
    createdAt: Date;
  }) {
    return {
      id: voucher.id,
      codePrefix: voucher.codePrefix,
      benefit: voucher.benefit,
      product: PREMIUM_PRODUCT_CODE,
      term: voucher.term,
      durationDays: voucher.durationDays,
      maxRedemptions: voucher.maxRedemptions,
      redeemedCount: voucher.redeemedCount,
      remaining: Math.max(0, voucher.maxRedemptions - voucher.redeemedCount),
      perUserLimit: voucher.perUserLimit,
      startsAt: voucher.startsAt.toISOString(),
      endsAt: voucher.endsAt?.toISOString() ?? null,
      status: effectiveVoucherStatus(voucher),
      storedStatus: voucher.status,
      campaign: voucher.campaign,
      createdAt: voucher.createdAt.toISOString(),
    };
  }

  private paymentView(payment: {
    id: string;
    providerPaymentId: string | null;
    providerStatus: string | null;
    status: string;
    currency: string;
    amountMinor: number;
    createdAt: Date;
    paidAt: Date | null;
    refundedAt: Date | null;
    syncedAt: Date | null;
    order: {
      product: { code: string };
      license: { id: string } | null;
      user: {
        id: string;
        email: string;
        activeCharacter: { name: string } | null;
      };
    };
  }) {
    return {
      id: payment.id,
      userId: payment.order.user.id,
      userName: userName(payment.order.user),
      email: payment.order.user.email,
      product: payment.order.product.code,
      providerPaymentId: payment.providerPaymentId,
      providerStatus: payment.providerStatus,
      status: payment.status,
      currency: payment.currency,
      amountMinor: payment.amountMinor,
      licenseId: payment.order.license?.id ?? null,
      createdAt: payment.createdAt.toISOString(),
      paidAt: payment.paidAt?.toISOString() ?? null,
      refundedAt: payment.refundedAt?.toISOString() ?? null,
      syncedAt: payment.syncedAt?.toISOString() ?? null,
    };
  }

  private async premiumProduct() {
    const product = await this.prisma.billingProduct.findUnique({
      where: { code: PREMIUM_PRODUCT_CODE },
    });
    if (!product?.active) {
      throw new NotFoundException('Produto não encontrado');
    }
    return product;
  }

  private async requireLicense(
    tx: Pick<PrismaService, 'billingLicense'>,
    id: string,
  ) {
    const license = await tx.billingLicense.findUnique({ where: { id } });
    if (!license) {
      throw new NotFoundException('Licença não encontrada');
    }
    return license;
  }

  private async assertNoCurrentLicense(
    tx: Pick<PrismaService, 'billingLicense'>,
    userId: string,
    productId: string,
  ) {
    const existing = await tx.billingLicense.findFirst({
      where: { userId, productId, status: 'ACTIVE' },
    });
    const suspended = await tx.billingLicense.findFirst({
      where: { userId, productId, status: 'SUSPENDED' },
    });
    if ((existing && licenseGrantsAccess(existing)) || suspended) {
      throw new BadRequestException('O usuário já possui licença ativa');
    }
    if (existing?.status === 'ACTIVE') {
      await tx.billingLicense.updateMany({
        where: { id: existing.id, status: 'ACTIVE' },
        data: { status: 'EXPIRED', activeUserProductKey: null },
      });
    }
  }
}
