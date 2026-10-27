import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AdminAuditService } from '../audit/admin-audit.service';
import { ReferralService } from '../referrals/referral.service';
import { licenseGrantsAccess } from './license-access';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import {
  APPROVED_BILLING_PRICES,
  BILLING_EVENT_TYPES,
  PREMIUM_PRODUCT_CODE,
  REVENUECAT_PROVIDER,
  activeUserProductKey,
  isBillingMarket,
  type BillingEventTypeCode,
  type BillingMarketCode,
} from './billing.constants';

type BillingTx = Prisma.TransactionClient;

type OrderRow = {
  id: string;
  userId: string;
  productId: string;
  status: string;
  currency: string;
  amountMinor: number;
};

type PaymentRow = {
  id: string;
  orderId: string;
  status: string;
  paidAt: Date | null;
  refundedAt: Date | null;
};

export type BillingOrderView = {
  id: string;
  userId: string;
  productCode: string;
  market: BillingMarketCode;
  currency: string;
  amountMinor: number;
  status: string;
};

export type BillingEventResult = {
  duplicate: boolean;
  orderId: string;
  orderStatus: string;
  licenseStatus: string | null;
};

export type ApplyBillingEventInput = {
  provider: string;
  providerEventId: string;
  providerPaymentId: string;
  orderId: string;
  type: BillingEventTypeCode;
};

export type PremiumView = {
  productCode: typeof PREMIUM_PRODUCT_CODE;
  access: boolean;
  licenseStatus: 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED' | null;
  paymentStatus: 'NONE' | 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  term: 'LIFETIME' | 'FIXED' | null;
  source:
    | 'PURCHASE'
    | 'VOUCHER'
    | 'ADMIN_GRANT'
    | 'PARTNERSHIP'
    | 'COMPENSATION'
    | null;
  expiresAt: string | null;
  activatedAt: string | null;
  channel: 'license' | 'store' | null;
};

export type CheckoutView = {
  orderId: string;
  checkoutUrl: string;
  amountMinor: number;
  currency: string;
  status: 'PENDING';
};

export function inactivePremium(): PremiumView {
  return {
    productCode: PREMIUM_PRODUCT_CODE,
    access: false,
    licenseStatus: null,
    paymentStatus: 'NONE',
    term: null,
    source: null,
    expiresAt: null,
    activatedAt: null,
    channel: null,
  };
}

function prismaCode(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function isUniqueConflict(error: unknown) {
  return prismaCode(error) === 'P2002';
}

function isMissingBillingSchema(error: unknown) {
  const code = prismaCode(error);
  return code === 'P2021' || code === 'P2022';
}

function isEventType(value: string): value is BillingEventTypeCode {
  return (BILLING_EVENT_TYPES as readonly string[]).includes(value);
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly audit?: AdminAuditService,
    @Optional() private readonly referrals?: ReferralService,
  ) {}

  async createOrder(userId: string, market: string): Promise<BillingOrderView> {
    if (!isBillingMarket(market)) {
      throw new BadRequestException('Unsupported billing market');
    }
    const approved = APPROVED_BILLING_PRICES[market];
    const product = await this.prisma.billingProduct.findUnique({
      where: { code: PREMIUM_PRODUCT_CODE },
    });
    if (!product?.active) {
      throw new NotFoundException('Billing product not found');
    }

    const price = await this.prisma.billingPrice.findUnique({
      where: {
        productId_market: { productId: product.id, market },
      },
    });
    if (
      !price?.active ||
      price.currency !== approved.currency ||
      !Number.isInteger(price.amountMinor) ||
      price.amountMinor !== approved.amountMinor
    ) {
      throw new ServiceUnavailableException('Billing price is not configured');
    }

    const activeLicense = await this.prisma.billingLicense.findFirst({
      where: {
        userId,
        productId: product.id,
        status: 'ACTIVE',
      },
    });
    if (activeLicense && licenseGrantsAccess(activeLicense)) {
      throw new ConflictException('Active license already exists');
    }
    const suspendedLicense = await this.prisma.billingLicense.findFirst({
      where: { userId, productId: product.id, status: 'SUSPENDED' },
    });
    if (suspendedLicense) {
      throw new ConflictException('Active license already exists');
    }

    const order = await this.prisma.billingOrder.create({
      data: {
        userId,
        productId: product.id,
        priceId: price.id,
        market,
        currency: price.currency,
        amountMinor: price.amountMinor,
        status: 'PENDING',
      },
    });

    return {
      id: order.id,
      userId: order.userId,
      productCode: product.code,
      market,
      currency: order.currency,
      amountMinor: order.amountMinor,
      status: order.status,
    };
  }

  private async syncReferral(type: string, orderId: string) {
    if (!this.referrals) return;
    try {
      if (type === 'PAYMENT_PAID')
        await this.referrals.settlePaidOrder(orderId);
      if (type === 'PAYMENT_REFUNDED')
        await this.referrals.holdAfterRefund(orderId);
    } catch (error) {
      this.logger.error(
        `Referral sync failed for order ${orderId}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  async applyProviderEvent(
    input: ApplyBillingEventInput,
  ): Promise<BillingEventResult> {
    const provider = input.provider?.trim() ?? '';
    const providerEventId = input.providerEventId?.trim() ?? '';
    const providerPaymentId = input.providerPaymentId?.trim() ?? '';
    const orderId = input.orderId?.trim() ?? '';
    if (!provider || !providerEventId || !providerPaymentId || !orderId) {
      throw new BadRequestException('Provider event is incomplete');
    }
    if (!isEventType(input.type)) {
      throw new BadRequestException('Unsupported billing event');
    }
    const event = {
      provider,
      providerEventId,
      providerPaymentId,
      orderId,
      type: input.type,
    };

    try {
      const result = await this.prisma.$transaction((tx) =>
        this.applyInTransaction(tx, event),
      );
      await this.syncReferral(event.type, event.orderId);
      return result;
    } catch (error) {
      if (!isUniqueConflict(error)) {
        throw error;
      }
      const existing = await this.prisma.billingEventReceipt.findUnique({
        where: {
          provider_providerEventId: { provider, providerEventId },
        },
      });
      if (
        existing &&
        existing.orderId === orderId &&
        existing.type === event.type
      ) {
        await this.syncReferral(event.type, orderId);
        return this.readResult(this.prisma, orderId, true);
      }
      throw new ConflictException('Billing record already exists');
    }
  }

  private async applyInTransaction(
    tx: BillingTx,
    input: ApplyBillingEventInput,
  ): Promise<BillingEventResult> {
    const existing = await tx.billingEventReceipt.findUnique({
      where: {
        provider_providerEventId: {
          provider: input.provider,
          providerEventId: input.providerEventId,
        },
      },
    });
    if (existing) {
      if (existing.orderId !== input.orderId || existing.type !== input.type) {
        throw new ConflictException('Provider event is already recorded');
      }
      return this.readResult(tx, input.orderId, true);
    }

    const order = await tx.billingOrder.findUnique({
      where: { id: input.orderId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const payment = await this.applyEventType(tx, order, input);
    await tx.billingEventReceipt.create({
      data: {
        provider: input.provider,
        providerEventId: input.providerEventId,
        type: input.type,
        orderId: order.id,
        paymentId: payment.id,
      },
    });
    if (this.audit) {
      await this.audit.record(
        {
          actorUserId: order.userId,
          action: 'payment.status',
          entityType: 'payment',
          entityId: payment.id,
          summary: `Pagamento ${input.type}`,
          metadata: {
            provider: input.provider,
            type: input.type,
            orderId: order.id,
          },
        },
        tx,
      );
    }
    return this.readResult(tx, order.id, false);
  }

  private async applyEventType(
    tx: BillingTx,
    order: OrderRow,
    input: ApplyBillingEventInput,
  ): Promise<PaymentRow> {
    if (input.type === 'PAYMENT_PENDING') {
      return this.markPending(tx, order, input);
    }
    if (input.type === 'PAYMENT_PAID') {
      return this.markPaid(tx, order, input);
    }
    if (input.type === 'PAYMENT_FAILED') {
      return this.markFailed(tx, order, input);
    }
    return this.markRefunded(tx, order, input);
  }

  private async markPending(
    tx: BillingTx,
    order: OrderRow,
    input: ApplyBillingEventInput,
  ): Promise<PaymentRow> {
    if (order.status === 'PAID' || order.status === 'REFUNDED') {
      const payment = await tx.billingPayment.findUnique({
        where: {
          provider_providerPaymentId: {
            provider: input.provider,
            providerPaymentId: input.providerPaymentId,
          },
        },
      });
      if (!payment || payment.orderId !== order.id) {
        throw new ConflictException('Order is no longer awaiting payment');
      }
      return payment;
    }
    if (order.status !== 'PENDING') {
      throw new ConflictException('Order is no longer awaiting payment');
    }
    return this.savePayment(tx, order, input, 'PENDING');
  }

  private async markPaid(
    tx: BillingTx,
    order: OrderRow,
    input: ApplyBillingEventInput,
  ): Promise<PaymentRow> {
    if (
      order.status === 'REFUNDED' ||
      order.status === 'CANCELLED' ||
      order.status === 'EXPIRED'
    ) {
      throw new ConflictException('Order cannot be paid');
    }

    if (order.status === 'PAID') {
      const payment = await tx.billingPayment.findUnique({
        where: {
          provider_providerPaymentId: {
            provider: input.provider,
            providerPaymentId: input.providerPaymentId,
          },
        },
      });
      if (
        !payment ||
        payment.orderId !== order.id ||
        payment.status !== 'PAID'
      ) {
        throw new ConflictException('Order is already paid');
      }
      await this.grantLicense(tx, order);
      return payment;
    }

    const payment = await this.savePayment(tx, order, input, 'PAID');
    if (order.status === 'PENDING') {
      const updated = await tx.billingOrder.updateMany({
        where: { id: order.id, status: 'PENDING' },
        data: { status: 'PAID', paidAt: new Date() },
      });
      if (updated.count !== 1) {
        const current = await tx.billingOrder.findUnique({
          where: { id: order.id },
        });
        if (current?.status !== 'PAID') {
          throw new ConflictException('Order cannot be paid');
        }
      }
    } else if (order.status !== 'PAID') {
      throw new ConflictException('Order cannot be paid');
    }

    await this.grantLicense(tx, order);
    return payment;
  }

  private async markFailed(
    tx: BillingTx,
    order: OrderRow,
    input: ApplyBillingEventInput,
  ): Promise<PaymentRow> {
    if (order.status !== 'PENDING') {
      throw new ConflictException('Order is no longer awaiting payment');
    }
    return this.savePayment(tx, order, input, 'FAILED');
  }

  // Refund and chargeback revoke the license but keep the row and the payment.
  // A later approved event cannot reopen that order. A transient provider
  // lookup never reaches this method, so it cannot revoke access by itself.
  private async markRefunded(
    tx: BillingTx,
    order: OrderRow,
    input: ApplyBillingEventInput,
  ): Promise<PaymentRow> {
    if (order.status !== 'PAID' && order.status !== 'REFUNDED') {
      throw new BadRequestException('Order cannot be refunded');
    }

    const payment = await this.savePayment(tx, order, input, 'REFUNDED');
    if (order.status === 'REFUNDED') {
      return payment;
    }

    const updated = await tx.billingOrder.updateMany({
      where: { id: order.id, status: 'PAID' },
      data: { status: 'REFUNDED', refundedAt: new Date() },
    });
    if (updated.count !== 1) {
      const current = await tx.billingOrder.findUnique({
        where: { id: order.id },
      });
      if (current?.status !== 'REFUNDED') {
        throw new ConflictException('Order cannot be refunded');
      }
    }

    const revoked = await tx.billingLicense.updateMany({
      where: { orderId: order.id, status: 'ACTIVE' },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        activeUserProductKey: null,
      },
    });
    if (revoked.count !== 1) {
      const license = await tx.billingLicense.findUnique({
        where: { orderId: order.id },
      });
      if (license?.status !== 'REVOKED') {
        throw new ConflictException('License cannot be revoked');
      }
    }
    return payment;
  }

  private async grantLicense(tx: BillingTx, order: OrderRow) {
    const existing = await tx.billingLicense.findUnique({
      where: { orderId: order.id },
    });
    if (existing) {
      if (existing.status !== 'ACTIVE') {
        throw new ConflictException('License cannot be granted');
      }
      return existing;
    }

    const other = await tx.billingLicense.findFirst({
      where: {
        userId: order.userId,
        productId: order.productId,
        status: 'ACTIVE',
      },
    });
    if (other && licenseGrantsAccess(other)) {
      throw new ConflictException('Active license already exists');
    }
    if (other?.status === 'ACTIVE') {
      await tx.billingLicense.updateMany({
        where: { id: other.id, status: 'ACTIVE' },
        data: { status: 'EXPIRED', activeUserProductKey: null },
      });
    }
    const suspended = await tx.billingLicense.findFirst({
      where: {
        userId: order.userId,
        productId: order.productId,
        status: 'SUSPENDED',
      },
    });
    if (suspended) {
      throw new ConflictException('Active license already exists');
    }

    return tx.billingLicense.create({
      data: {
        userId: order.userId,
        productId: order.productId,
        orderId: order.id,
        source: 'PURCHASE',
        term: 'LIFETIME',
        status: 'ACTIVE',
        activeUserProductKey: activeUserProductKey(
          order.userId,
          order.productId,
        ),
      },
    });
  }

  private async savePayment(
    tx: BillingTx,
    order: OrderRow,
    input: ApplyBillingEventInput,
    status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED',
  ): Promise<PaymentRow> {
    const existing = await tx.billingPayment.findUnique({
      where: {
        provider_providerPaymentId: {
          provider: input.provider,
          providerPaymentId: input.providerPaymentId,
        },
      },
    });
    const now = new Date();
    if (!existing) {
      if (status === 'REFUNDED') {
        throw new NotFoundException('Payment not found');
      }
      const placeholder = await tx.billingPayment.findFirst({
        where: {
          orderId: order.id,
          provider: input.provider,
          providerPaymentId: null,
          status: 'PENDING',
        },
        orderBy: { createdAt: 'desc' },
      });
      if (placeholder) {
        return tx.billingPayment.update({
          where: { id: placeholder.id },
          data: {
            providerPaymentId: input.providerPaymentId,
            status,
            paidAt: status === 'PAID' ? now : placeholder.paidAt,
            refundedAt: null,
          },
        });
      }
      return tx.billingPayment.create({
        data: {
          orderId: order.id,
          provider: input.provider,
          providerPaymentId: input.providerPaymentId,
          status,
          currency: order.currency as 'BRL' | 'USD',
          amountMinor: order.amountMinor,
          paidAt: status === 'PAID' ? now : null,
        },
      });
    }
    if (existing.orderId !== order.id) {
      throw new ConflictException('Payment belongs to another order');
    }
    if (existing.status === 'REFUNDED' && status !== 'REFUNDED') {
      throw new ConflictException('Payment is already refunded');
    }
    if (
      existing.status === 'PAID' &&
      (status === 'FAILED' || status === 'PENDING')
    ) {
      throw new ConflictException('Paid payment cannot fail');
    }
    if (existing.status === status) {
      return existing;
    }
    if (status === 'REFUNDED' && existing.status !== 'PAID') {
      throw new ConflictException('Payment cannot be refunded');
    }
    return tx.billingPayment.update({
      where: { id: existing.id },
      data: {
        status,
        paidAt: status === 'PAID' ? (existing.paidAt ?? now) : existing.paidAt,
        refundedAt: status === 'REFUNDED' ? now : existing.refundedAt,
      },
    });
  }

  async getPremium(userId: string): Promise<PremiumView> {
    try {
      return await this.loadPremium(userId);
    } catch (error) {
      if (!isMissingBillingSchema(error)) {
        throw error;
      }
      this.logger.error(
        `Billing schema is unavailable (${prismaCode(error)}). Premium access denied until the billing migrations are applied.`,
      );
      return inactivePremium();
    }
  }

  private async loadPremium(userId: string): Promise<PremiumView> {
    const product = await this.prisma.billingProduct.findUnique({
      where: { code: PREMIUM_PRODUCT_CODE },
    });
    if (!product) {
      return inactivePremium();
    }

    const active = await this.prisma.billingLicense.findFirst({
      where: { userId, productId: product.id, status: 'ACTIVE' },
    });
    const current = active && licenseGrantsAccess(active) ? active : null;
    const suspended = current
      ? null
      : await this.prisma.billingLicense.findFirst({
          where: { userId, productId: product.id, status: 'SUSPENDED' },
        });
    const storeEntitlement =
      await this.prisma.billingStoreEntitlement.findFirst({
        where: {
          userId,
          productId: product.id,
          provider: REVENUECAT_PROVIDER,
          active: true,
        },
      });
    const latestLicense =
      current ??
      suspended ??
      (await this.prisma.billingLicense.findFirst({
        where: { userId, productId: product.id },
        orderBy: { createdAt: 'desc' },
      }));
    const payment = await this.prisma.billingPayment.findFirst({
      where: { order: { userId, productId: product.id } },
      orderBy: { createdAt: 'desc' },
    });
    const licenseStatus = current
      ? 'ACTIVE'
      : active
        ? 'EXPIRED'
        : suspended
          ? 'SUSPENDED'
          : storeEntitlement
            ? 'ACTIVE'
            : latestLicense?.status === 'REVOKED' ||
                latestLicense?.status === 'EXPIRED' ||
                latestLicense?.status === 'SUSPENDED'
              ? latestLicense.status
              : null;
    const shown = current ?? (active && !current ? active : suspended);

    return {
      productCode: PREMIUM_PRODUCT_CODE,
      access: Boolean(current || storeEntitlement),
      licenseStatus,
      paymentStatus: payment?.status ?? (storeEntitlement ? 'PAID' : 'NONE'),
      term: shown?.term ?? null,
      source: shown?.source ?? null,
      expiresAt: shown?.expiresAt?.toISOString() ?? null,
      activatedAt: shown?.grantedAt?.toISOString() ?? null,
      channel: current ? 'license' : storeEntitlement ? 'store' : null,
    };
  }

  async syncStoreEntitlement(userId: string, active: boolean) {
    const product = await this.prisma.billingProduct.findUnique({
      where: { code: PREMIUM_PRODUCT_CODE },
    });
    if (!product?.active) {
      throw new ServiceUnavailableException(
        'Billing product is not configured',
      );
    }
    await this.prisma.billingStoreEntitlement.upsert({
      where: {
        userId_provider_productId: {
          userId,
          provider: REVENUECAT_PROVIDER,
          productId: product.id,
        },
      },
      create: {
        userId,
        productId: product.id,
        provider: REVENUECAT_PROVIDER,
        active,
        syncedAt: new Date(),
      },
      update: { active, syncedAt: new Date() },
    });
    return this.getPremium(userId);
  }

  async findOpenCheckout(userId: string): Promise<CheckoutView | null> {
    const payment = await this.prisma.billingPayment.findFirst({
      where: {
        status: 'PENDING',
        checkoutUrl: { not: null },
        order: {
          userId,
          status: 'PENDING',
          market: 'BR',
          product: { code: PREMIUM_PRODUCT_CODE },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment?.checkoutUrl) {
      return null;
    }
    return {
      orderId: payment.orderId,
      checkoutUrl: payment.checkoutUrl,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      status: 'PENDING',
    };
  }

  async findPendingBrazilOrder(userId: string) {
    return this.prisma.billingOrder.findFirst({
      where: {
        userId,
        status: 'PENDING',
        market: 'BR',
        product: { code: PREMIUM_PRODUCT_CODE },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOrderForProvider(orderId: string) {
    const order = await this.prisma.billingOrder.findUnique({
      where: { id: orderId },
    });
    if (!order || order.market !== 'BR') {
      return null;
    }
    const product = await this.prisma.billingProduct.findUnique({
      where: { id: order.productId },
    });
    if (product?.code !== PREMIUM_PRODUCT_CODE) {
      return null;
    }
    return order;
  }

  async findLatestBrazilOrder(userId: string) {
    return this.prisma.billingOrder.findFirst({
      where: {
        userId,
        market: 'BR',
        product: { code: PREMIUM_PRODUCT_CODE },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async attachCheckout(input: {
    orderId: string;
    provider: string;
    providerCheckoutId: string;
    checkoutUrl: string;
  }): Promise<CheckoutView> {
    const order = await this.prisma.billingOrder.findUnique({
      where: { id: input.orderId },
    });
    if (!order || order.status !== 'PENDING' || order.market !== 'BR') {
      throw new ConflictException('Order cannot be paid');
    }
    const approved = APPROVED_BILLING_PRICES.BR;
    if (
      order.currency !== approved.currency ||
      order.amountMinor !== approved.amountMinor
    ) {
      throw new ServiceUnavailableException('Billing price is not configured');
    }

    const payment = await this.prisma.billingPayment.create({
      data: {
        orderId: order.id,
        provider: input.provider,
        providerCheckoutId: input.providerCheckoutId,
        checkoutUrl: input.checkoutUrl,
        status: 'PENDING',
        currency: order.currency,
        amountMinor: order.amountMinor,
      },
    });
    return {
      orderId: order.id,
      checkoutUrl: payment.checkoutUrl || input.checkoutUrl,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      status: 'PENDING',
    };
  }

  private async readResult(
    tx: BillingTx | PrismaService,
    orderId: string,
    duplicate: boolean,
  ): Promise<BillingEventResult> {
    const order = await tx.billingOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    const license = await tx.billingLicense.findUnique({ where: { orderId } });
    return {
      duplicate,
      orderId: order.id,
      orderStatus: order.status,
      licenseStatus: license?.status ?? null,
    };
  }
}
