import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { StartCheckoutDto } from './dto/start-checkout.dto';
import { BillingService, type PremiumView } from './billing.service';
import { BillingCheckoutAttemptService } from './billing-checkout-attempt.service';
import {
  APPROVED_BILLING_PRICES,
  MERCADO_PAGO_PROVIDER,
} from './billing.constants';
import {
  MercadoPagoClient,
  type MercadoPagoPayment,
  type PreferenceCreateOutcome,
} from './mercado-pago.client';
import { verifyMercadoPagoSignature } from './mercado-pago.signature';
import { mapMercadoPagoStatus } from './mercado-pago.status';

export type MercadoPagoNotification = {
  signature: string | undefined;
  requestId: string | undefined;
  dataId: string | undefined;
};

export type CheckoutStartView = {
  outcome: 'ready' | 'in_progress' | 'reconciliation_required';
  orderId: string;
  checkoutUrl: string | null;
  amountMinor: number;
  currency: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'RECONCILIATION_REQUIRED';
};

@Injectable()
export class BillingCheckoutService {
  private readonly logger = new Logger(BillingCheckoutService.name);

  constructor(
    private readonly billing: BillingService,
    private readonly attempts: BillingCheckoutAttemptService,
    private readonly mercadoPago: MercadoPagoClient,
  ) {}

  async start(
    userId: string,
    body: StartCheckoutDto,
  ): Promise<CheckoutStartView> {
    void body;
    const premium = await this.billing.getPremium(userId);
    if (premium.access) {
      throw new ConflictException('Active license already exists');
    }

    const open = await this.billing.findOpenCheckout(userId);
    if (
      open?.providerCheckoutId &&
      (await this.mercadoPago.canReusePreference(open.providerCheckoutId))
    ) {
      return this.publicCheckout({
        outcome: 'ready',
        orderId: open.orderId,
        checkoutUrl: open.checkoutUrl,
        amountMinor: open.amountMinor,
        currency: open.currency,
      });
    }

    const pending = await this.billing.findPendingBrazilOrder(userId);
    const order = pending
      ? {
          id: pending.id,
          amountMinor: pending.amountMinor,
          currency: pending.currency,
        }
      : await this.billing.createOrder(userId, 'BR');

    const leaseOwner = randomUUID();
    const reservation = await this.attempts.acquire({
      userId,
      orderId: order.id,
      leaseOwner,
    });

    if (reservation.outcome === 'in_progress') {
      this.logger.log(
        `Checkout reservation in_progress order=${order.id} attempt=${reservation.attempt.id}`,
      );
      return this.publicCheckout({
        outcome: 'in_progress',
        orderId: order.id,
        checkoutUrl: null,
        amountMinor: order.amountMinor,
        currency: order.currency,
      });
    }

    if (reservation.outcome === 'reconciliation_required') {
      this.logger.warn(
        `Checkout reservation requires reconciliation order=${order.id} attempt=${reservation.attempt.id}`,
      );
      return this.publicCheckout({
        outcome: 'reconciliation_required',
        orderId: order.id,
        checkoutUrl: null,
        amountMinor: order.amountMinor,
        currency: order.currency,
      });
    }

    const preference = await this.mercadoPago.createPreferenceOutcome({
      orderId: order.id,
      amountMinor: order.amountMinor,
    });

    if (!preference.ok) {
      return this.finishFailedPreference(
        reservation.attempt.id,
        leaseOwner,
        order,
        preference,
      );
    }

    try {
      return await this.attempts.completeReady(
        {
          id: reservation.attempt.id,
          leaseOwner,
          providerCheckoutId: preference.id,
          expectedUserId: userId,
          expectedOrderId: order.id,
        },
        async (tx) => {
          const attached = await this.billing.attachCheckoutInTx(tx, {
            orderId: order.id,
            provider: MERCADO_PAGO_PROVIDER,
            providerCheckoutId: preference.id,
            checkoutUrl: preference.initPoint,
          });
          return {
            paymentId: attached.paymentId,
            result: this.publicCheckout({
              outcome: 'ready',
              orderId: attached.view.orderId,
              checkoutUrl: attached.view.checkoutUrl,
              amountMinor: attached.view.amountMinor,
              currency: attached.view.currency,
            }),
          };
        },
      );
    } catch (error) {
      this.logger.warn(
        `Checkout local persist failed order=${order.id} attempt=${reservation.attempt.id}`,
      );
      void error;
      await this.safeMarkUnknown(
        reservation.attempt.id,
        leaseOwner,
        'local_persist_failed',
        'Checkout preference may exist but was not persisted',
      );
      return this.publicCheckout({
        outcome: 'reconciliation_required',
        orderId: order.id,
        checkoutUrl: null,
        amountMinor: order.amountMinor,
        currency: order.currency,
      });
    }
  }

  async refresh(userId: string, body: StartCheckoutDto): Promise<PremiumView> {
    void body;
    const order = await this.billing.findLatestBrazilOrder(userId);
    if (!order) {
      return this.billing.getPremium(userId);
    }
    const payments = await this.mercadoPago.searchPayments(order.id);
    for (const payment of payments) {
      await this.applyConfirmedPayment(payment);
    }
    return this.billing.getPremium(userId);
  }

  async reconcileProviderPayment(providerPaymentId: string) {
    const payment = await this.mercadoPago.getPayment(providerPaymentId);
    await this.applyConfirmedPayment(payment);
    return {
      providerStatus: payment.status,
      providerPaymentId: payment.id,
    };
  }

  async handleWebhook(notification: MercadoPagoNotification) {
    const config = this.mercadoPago.config();
    const valid = verifyMercadoPagoSignature({
      signatureHeader: notification.signature,
      requestId: notification.requestId,
      dataId: notification.dataId,
      secret: config?.webhookSecret,
    });
    if (!valid || !notification.dataId) {
      throw new UnauthorizedException('Invalid notification');
    }

    const payment = await this.mercadoPago.getPayment(notification.dataId);
    await this.applyConfirmedPayment(payment);
    return { received: true };
  }

  private async finishFailedPreference(
    attemptId: string,
    leaseOwner: string,
    order: { id: string; amountMinor: number; currency: string },
    preference: Extract<PreferenceCreateOutcome, { ok: false }>,
  ): Promise<CheckoutStartView> {
    if (preference.failure === 'definitive') {
      await this.attempts.markFailed({
        id: attemptId,
        leaseOwner,
        errorCode: preference.errorCode,
        errorMessage: preference.message,
      });
      throw new ServiceUnavailableException('Billing provider request failed');
    }
    await this.safeMarkUnknown(
      attemptId,
      leaseOwner,
      preference.errorCode,
      preference.message,
    );
    return this.publicCheckout({
      outcome: 'reconciliation_required',
      orderId: order.id,
      checkoutUrl: null,
      amountMinor: order.amountMinor,
      currency: order.currency,
    });
  }

  private async safeMarkUnknown(
    attemptId: string,
    leaseOwner: string,
    errorCode: string | null,
    errorMessage: string | null,
  ) {
    try {
      await this.attempts.markUnknown({
        id: attemptId,
        leaseOwner,
        errorCode,
        errorMessage,
      });
    } catch {
      this.logger.warn(
        `Checkout attempt ${attemptId} could not be marked UNKNOWN`,
      );
    }
  }

  private publicCheckout(input: {
    outcome: CheckoutStartView['outcome'];
    orderId: string;
    checkoutUrl: string | null;
    amountMinor: number;
    currency: string;
  }): CheckoutStartView {
    const status =
      input.outcome === 'ready'
        ? 'PENDING'
        : input.outcome === 'in_progress'
          ? 'IN_PROGRESS'
          : 'RECONCILIATION_REQUIRED';
    return {
      outcome: input.outcome,
      orderId: input.orderId,
      checkoutUrl: input.outcome === 'ready' ? input.checkoutUrl : null,
      amountMinor: input.amountMinor,
      currency: input.currency,
      status,
    };
  }

  private async applyConfirmedPayment(payment: MercadoPagoPayment) {
    const type = mapMercadoPagoStatus(payment.status);
    const approved = APPROVED_BILLING_PRICES.BR;
    const matchesPrice =
      payment.currency === approved.currency &&
      payment.amountMinor === approved.amountMinor;
    if (!type || !payment.id || !payment.externalReference || !matchesPrice) {
      this.logger.warn(
        `Ignoring Mercado Pago payment ${payment.id || 'unknown'} for order ${payment.externalReference || 'unknown'}`,
      );
      return;
    }

    const order = await this.billing.findOrderForProvider(
      payment.externalReference,
    );
    if (
      !order ||
      order.amountMinor !== payment.amountMinor ||
      order.currency !== payment.currency
    ) {
      this.logger.warn(
        `Ignoring Mercado Pago payment ${payment.id} for order ${payment.externalReference}`,
      );
      return;
    }

    const result = await this.billing.applyProviderEvent({
      provider: MERCADO_PAGO_PROVIDER,
      providerEventId: `payment:${payment.id}:${type}`,
      providerPaymentId: payment.id,
      orderId: order.id,
      type,
      providerCheckoutId: payment.preferenceId,
    });

    await this.reconcileAttemptsForPayment(order.id, payment, result.duplicate);
  }

  private async reconcileAttemptsForPayment(
    orderId: string,
    payment: MercadoPagoPayment,
    duplicate: boolean,
  ) {
    let attempts: Awaited<
      ReturnType<BillingCheckoutAttemptService['listByOrder']>
    >;
    try {
      attempts = await this.attempts.listByOrder(orderId);
    } catch {
      return;
    }
    if (attempts.length === 0) {
      return;
    }

    const latest = attempts[attempts.length - 1];
    const matchingUnknown = payment.preferenceId
      ? attempts.find(
          (row) =>
            row.state === 'UNKNOWN' &&
            row.providerCheckoutId === payment.preferenceId,
        )
      : undefined;

    if (latest && latest.providerCheckoutId && payment.preferenceId) {
      if (latest.providerCheckoutId !== payment.preferenceId) {
        this.logger.warn(
          `Late Mercado Pago payment ${payment.id} for order ${orderId} matched an older preference while a newer attempt ${latest.id} exists`,
        );
      }
    } else if (attempts.some((row) => row.state === 'UNKNOWN')) {
      this.logger.warn(
        `Mercado Pago payment ${payment.id} arrived while checkout attempt for order ${orderId} is UNKNOWN`,
      );
    }

    void duplicate;
    if (!matchingUnknown) {
      return;
    }

    const localPayment = await this.billing.findPaymentByProvider(
      MERCADO_PAGO_PROVIDER,
      payment.id,
    );
    if (!localPayment || !payment.preferenceId) {
      return;
    }

    try {
      await this.attempts.reconcileUnknown({
        id: matchingUnknown.id,
        outcome: 'READY',
        providerCheckoutId: payment.preferenceId,
        billingPaymentId: localPayment.id,
      });
    } catch {
      this.logger.warn(
        `Could not reconcile UNKNOWN attempt ${matchingUnknown.id} after payment ${payment.id}`,
      );
    }
  }
}
