import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { StartCheckoutDto } from './dto/start-checkout.dto';
import { BillingService, type PremiumView } from './billing.service';
import {
  APPROVED_BILLING_PRICES,
  MERCADO_PAGO_PROVIDER,
} from './billing.constants';
import {
  MercadoPagoClient,
  type MercadoPagoPayment,
} from './mercado-pago.client';
import { verifyMercadoPagoSignature } from './mercado-pago.signature';
import { mapMercadoPagoStatus } from './mercado-pago.status';

export type MercadoPagoNotification = {
  signature: string | undefined;
  requestId: string | undefined;
  dataId: string | undefined;
};

@Injectable()
export class BillingCheckoutService {
  private readonly logger = new Logger(BillingCheckoutService.name);

  constructor(
    private readonly billing: BillingService,
    private readonly mercadoPago: MercadoPagoClient,
  ) {}

  async start(userId: string, body: StartCheckoutDto) {
    void body;
    const premium = await this.billing.getPremium(userId);
    if (premium.access) {
      throw new ConflictException('Active license already exists');
    }

    const open = await this.billing.findOpenCheckout(userId);
    if (open) {
      return open;
    }

    const pending = await this.billing.findPendingBrazilOrder(userId);
    const order = pending
      ? {
          id: pending.id,
          amountMinor: pending.amountMinor,
          currency: pending.currency,
        }
      : await this.billing.createOrder(userId, 'BR');

    const preference = await this.mercadoPago.createPreference({
      orderId: order.id,
      amountMinor: order.amountMinor,
    });
    return this.billing.attachCheckout({
      orderId: order.id,
      provider: MERCADO_PAGO_PROVIDER,
      providerCheckoutId: preference.id,
      checkoutUrl: preference.initPoint,
    });
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

    await this.billing.applyProviderEvent({
      provider: MERCADO_PAGO_PROVIDER,
      providerEventId: `payment:${payment.id}:${type}`,
      providerPaymentId: payment.id,
      orderId: order.id,
      type,
    });
  }
}
