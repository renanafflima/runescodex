import {
  ConflictException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BillingCheckoutService } from './billing-checkout.service';
import { BillingService, inactivePremium } from './billing.service';
import { StartCheckoutDto } from './dto/start-checkout.dto';
import { MercadoPagoClient } from './mercado-pago.client';
import {
  mercadoPagoManifest,
  signMercadoPagoManifest,
} from './mercado-pago.signature';

describe('BillingCheckoutService', () => {
  const secret = 'webhook-test-secret';
  const billing = {
    getPremium: jest.fn(),
    findOpenCheckout: jest.fn(),
    findPendingBrazilOrder: jest.fn(),
    createOrder: jest.fn(),
    attachCheckout: jest.fn(),
    findLatestBrazilOrder: jest.fn(),
    findOrderForProvider: jest.fn(),
    applyProviderEvent: jest.fn(),
  };
  const mercadoPago = {
    config: jest.fn().mockReturnValue({ webhookSecret: secret }),
    createPreference: jest.fn(),
    getPayment: jest.fn(),
    searchPayments: jest.fn(),
  };
  let service: BillingCheckoutService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mercadoPago.config.mockReturnValue({ webhookSecret: secret });
    billing.getPremium.mockResolvedValue(inactivePremium());
    billing.findOpenCheckout.mockResolvedValue(null);
    billing.findPendingBrazilOrder.mockResolvedValue(null);
    billing.applyProviderEvent.mockResolvedValue({ duplicate: false });
    const moduleRef = await Test.createTestingModule({
      providers: [
        BillingCheckoutService,
        { provide: BillingService, useValue: billing },
        { provide: MercadoPagoClient, useValue: mercadoPago },
      ],
    }).compile();
    service = moduleRef.get(BillingCheckoutService);
  });

  function signed(dataId: string) {
    const ts = '1700000000';
    const requestId = 'req-1';
    const v1 = signMercadoPagoManifest(
      mercadoPagoManifest(dataId, requestId, ts),
      secret,
    );
    return {
      signature: `ts=${ts},v1=${v1}`,
      requestId,
      dataId,
    };
  }

  function payment(overrides = {}) {
    return {
      id: '9001',
      status: 'approved',
      externalReference: 'order-1',
      currency: 'BRL',
      amountMinor: 4990,
      transactionAmount: 49.9,
      ...overrides,
    };
  }

  it('creates a checkout from the official server price', async () => {
    billing.createOrder.mockResolvedValue({
      id: 'order-1',
      amountMinor: 4990,
      currency: 'BRL',
      status: 'PENDING',
    });
    mercadoPago.createPreference.mockResolvedValue({
      id: 'pref-1',
      initPoint:
        'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-1',
    });
    billing.attachCheckout.mockImplementation(
      (input: { orderId: string; checkoutUrl: string }) => ({
        orderId: input.orderId,
        checkoutUrl: input.checkoutUrl,
        amountMinor: 4990,
        currency: 'BRL',
        status: 'PENDING',
      }),
    );

    const result = await service.start('user-1', {});

    expect(billing.createOrder).toHaveBeenCalledWith('user-1', 'BR');
    expect(mercadoPago.createPreference).toHaveBeenCalledWith({
      orderId: 'order-1',
      amountMinor: 4990,
    });
    expect(result).toMatchObject({
      amountMinor: 4990,
      currency: 'BRL',
      status: 'PENDING',
    });
  });

  it('rejects a body that tries to choose the price', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      pipe.transform(
        { amountMinor: 100, currency: 'USD' },
        { type: 'body', metatype: StartCheckoutDto },
      ),
    ).rejects.toThrow();
  });

  it('does not open another paid checkout when a license is active', async () => {
    billing.getPremium.mockResolvedValue({
      ...inactivePremium(),
      access: true,
      licenseStatus: 'ACTIVE',
    });

    await expect(service.start('user-1', {})).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(billing.createOrder).not.toHaveBeenCalled();
    expect(mercadoPago.createPreference).not.toHaveBeenCalled();
  });

  it('does not grant premium from an invalid webhook', async () => {
    await expect(
      service.handleWebhook({
        signature: 'ts=1,v1=deadbeef',
        requestId: 'req-1',
        dataId: '9001',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(mercadoPago.getPayment).not.toHaveBeenCalled();
    expect(billing.applyProviderEvent).not.toHaveBeenCalled();
  });

  it('grants through the billing service only after the provider confirms approval', async () => {
    mercadoPago.getPayment.mockResolvedValue(payment());
    billing.findOrderForProvider.mockResolvedValue({
      id: 'order-1',
      amountMinor: 4990,
      currency: 'BRL',
    });

    await service.handleWebhook(signed('9001'));

    expect(billing.applyProviderEvent).toHaveBeenCalledWith({
      provider: 'mercadopago',
      providerEventId: 'payment:9001:PAYMENT_PAID',
      providerPaymentId: '9001',
      orderId: 'order-1',
      type: 'PAYMENT_PAID',
    });
  });

  it('keeps access blocked when the provider payment is still pending', async () => {
    mercadoPago.getPayment.mockResolvedValue(payment({ status: 'pending' }));
    billing.findOrderForProvider.mockResolvedValue({
      id: 'order-1',
      amountMinor: 4990,
      currency: 'BRL',
    });

    await service.handleWebhook(signed('9001'));

    expect(billing.applyProviderEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PAYMENT_PENDING' }),
    );
  });

  it('uses the same event id when the approved webhook is repeated', async () => {
    mercadoPago.getPayment.mockResolvedValue(payment());
    billing.findOrderForProvider.mockResolvedValue({
      id: 'order-1',
      amountMinor: 4990,
      currency: 'BRL',
    });
    billing.applyProviderEvent
      .mockResolvedValueOnce({ duplicate: false })
      .mockResolvedValueOnce({ duplicate: true });

    await service.handleWebhook(signed('9001'));
    await service.handleWebhook(signed('9001'));

    expect(billing.applyProviderEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ providerEventId: 'payment:9001:PAYMENT_PAID' }),
    );
    expect(billing.applyProviderEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ providerEventId: 'payment:9001:PAYMENT_PAID' }),
    );
  });

  it('does not grant premium when the provider amount does not match the order', async () => {
    mercadoPago.getPayment.mockResolvedValue(
      payment({ amountMinor: 1000, transactionAmount: 10 }),
    );
    billing.findOrderForProvider.mockResolvedValue({
      id: 'order-1',
      amountMinor: 4990,
      currency: 'BRL',
    });

    await service.handleWebhook(signed('9001'));

    expect(billing.applyProviderEvent).not.toHaveBeenCalled();
  });

  it('maps a confirmed refund to the billing refund event', async () => {
    mercadoPago.getPayment.mockResolvedValue(payment({ status: 'refunded' }));
    billing.findOrderForProvider.mockResolvedValue({
      id: 'order-1',
      amountMinor: 4990,
      currency: 'BRL',
    });

    await service.handleWebhook(signed('9001'));

    expect(billing.applyProviderEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PAYMENT_REFUNDED',
        providerEventId: 'payment:9001:PAYMENT_REFUNDED',
      }),
    );
  });

  it('does not grant premium when the provider payment has no known order', async () => {
    mercadoPago.getPayment.mockResolvedValue(
      payment({ externalReference: '' }),
    );

    await service.handleWebhook(signed('9001'));

    expect(billing.findOrderForProvider).not.toHaveBeenCalled();
    expect(billing.applyProviderEvent).not.toHaveBeenCalled();
  });

  it('maps a chargeback to the refund event and does not approve it', async () => {
    mercadoPago.getPayment.mockResolvedValue(
      payment({ status: 'charged_back' }),
    );
    billing.findOrderForProvider.mockResolvedValue({
      id: 'order-1',
      amountMinor: 4990,
      currency: 'BRL',
    });

    await service.handleWebhook(signed('9001'));

    expect(billing.applyProviderEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PAYMENT_REFUNDED' }),
    );
  });
});
