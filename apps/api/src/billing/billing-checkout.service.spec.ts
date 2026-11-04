import {
  ConflictException,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BillingCheckoutAttemptService } from './billing-checkout-attempt.service';
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
    attachCheckoutInTx: jest.fn(),
    findLatestBrazilOrder: jest.fn(),
    findOrderForProvider: jest.fn(),
    applyProviderEvent: jest.fn(),
    findPaymentByProvider: jest.fn(),
  };
  const attempts = {
    acquire: jest.fn(),
    completeReady: jest.fn(),
    markFailed: jest.fn(),
    markUnknown: jest.fn(),
    listByOrder: jest.fn(),
    reconcileUnknown: jest.fn(),
  };
  const mercadoPago = {
    config: jest.fn().mockReturnValue({ webhookSecret: secret }),
    canReusePreference: jest.fn(),
    createPreference: jest.fn(),
    createPreferenceOutcome: jest.fn(),
    getPayment: jest.fn(),
    searchPayments: jest.fn(),
  };
  let service: BillingCheckoutService;
  const logs: string[] = [];

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    logs.length = 0;
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message) => {
      logs.push(String(message));
      return Logger.prototype;
    });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((message) => {
      logs.push(String(message));
      return Logger.prototype;
    });
    jest.spyOn(Logger.prototype, 'error').mockImplementation((message) => {
      logs.push(String(message));
      return Logger.prototype;
    });
    mercadoPago.config.mockReturnValue({ webhookSecret: secret });
    billing.getPremium.mockResolvedValue(inactivePremium());
    billing.findOpenCheckout.mockResolvedValue(null);
    billing.findPendingBrazilOrder.mockResolvedValue(null);
    billing.applyProviderEvent.mockResolvedValue({ duplicate: false });
    billing.findPaymentByProvider.mockResolvedValue(null);
    attempts.listByOrder.mockResolvedValue([]);
    mercadoPago.canReusePreference.mockResolvedValue(false);
    const moduleRef = await Test.createTestingModule({
      providers: [
        BillingCheckoutService,
        { provide: BillingService, useValue: billing },
        { provide: BillingCheckoutAttemptService, useValue: attempts },
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
      preferenceId: 'pref-old',
      ...overrides,
    };
  }

  function creatingAttempt() {
    return {
      id: 'attempt-1',
      userId: 'user-1',
      orderId: 'order-1',
      generation: 1,
      state: 'CREATING',
      idempotencyKey: 'rc-checkout:order-1:1',
    };
  }

  function expectNoSecrets() {
    const text = JSON.stringify(logs);
    expect(text).not.toMatch(/APP_USR-|TEST-[A-Za-z0-9]|eyJ[A-Za-z0-9_-]+\./);
    expect(text).not.toMatch(/https:\/\/www\.mercadopago/);
    expect(text).not.toMatch(/accessToken|Authorization|jwt/i);
  }

  it('creates a reservation and preference for a new purchase', async () => {
    billing.createOrder.mockResolvedValue({
      id: 'order-1',
      amountMinor: 4990,
      currency: 'BRL',
      status: 'PENDING',
    });
    attempts.acquire.mockResolvedValue({
      outcome: 'acquired',
      attempt: creatingAttempt(),
    });
    mercadoPago.createPreferenceOutcome.mockResolvedValue({
      ok: true,
      id: 'pref-1',
      initPoint:
        'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-1',
    });
    attempts.completeReady.mockImplementation(
      async (
        _input: unknown,
        persist: (
          tx: unknown,
          attempt: unknown,
        ) => Promise<{ paymentId: string; result: unknown }>,
      ) => {
        const persisted = await persist({}, creatingAttempt());
        expect(persisted.paymentId).toBe('pay-1');
        return persisted.result;
      },
    );
    billing.attachCheckoutInTx.mockResolvedValue({
      paymentId: 'pay-1',
      view: {
        orderId: 'order-1',
        checkoutUrl:
          'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-1',
        amountMinor: 4990,
        currency: 'BRL',
        status: 'PENDING',
      },
    });

    const result = await service.start('user-1', {});

    expect(attempts.acquire).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', orderId: 'order-1' }),
    );
    expect(mercadoPago.createPreferenceOutcome).toHaveBeenCalledWith({
      orderId: 'order-1',
      amountMinor: 4990,
    });
    expect(result).toEqual({
      outcome: 'ready',
      orderId: 'order-1',
      checkoutUrl:
        'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-1',
      amountMinor: 4990,
      currency: 'BRL',
      status: 'PENDING',
    });
    expect(JSON.stringify(result)).not.toMatch(/attempt-1|leaseOwner|APP_USR/);
    expectNoSecrets();
  });

  it('does not POST to Mercado Pago when a concurrent request is in_progress', async () => {
    billing.createOrder.mockResolvedValue({
      id: 'order-1',
      amountMinor: 4990,
      currency: 'BRL',
    });
    attempts.acquire.mockResolvedValue({
      outcome: 'in_progress',
      attempt: creatingAttempt(),
    });

    const result = await service.start('user-1', {});

    expect(result.outcome).toBe('in_progress');
    expect(result.checkoutUrl).toBeNull();
    expect(mercadoPago.createPreferenceOutcome).not.toHaveBeenCalled();
    expect(attempts.completeReady).not.toHaveBeenCalled();
  });

  it('treats a double click as a second acquire that must not POST again', async () => {
    billing.createOrder.mockResolvedValue({
      id: 'order-1',
      amountMinor: 4990,
      currency: 'BRL',
    });
    attempts.acquire
      .mockResolvedValueOnce({
        outcome: 'acquired',
        attempt: creatingAttempt(),
      })
      .mockResolvedValueOnce({
        outcome: 'in_progress',
        attempt: creatingAttempt(),
      });
    mercadoPago.createPreferenceOutcome.mockResolvedValue({
      ok: true,
      id: 'pref-1',
      initPoint: 'https://www.mercadopago.com.br/checkout/pref-1',
    });
    attempts.completeReady.mockResolvedValue({
      outcome: 'ready',
      orderId: 'order-1',
      checkoutUrl: 'https://www.mercadopago.com.br/checkout/pref-1',
      amountMinor: 4990,
      currency: 'BRL',
      status: 'PENDING',
    });

    await service.start('user-1', {});
    const retry = await service.start('user-1', {});

    expect(mercadoPago.createPreferenceOutcome).toHaveBeenCalledTimes(1);
    expect(retry.outcome).toBe('in_progress');
  });

  it('does not call Mercado Pago again while the reservation is CREATING', async () => {
    billing.findPendingBrazilOrder.mockResolvedValue({
      id: 'order-1',
      amountMinor: 4990,
      currency: 'BRL',
    });
    attempts.acquire.mockResolvedValue({
      outcome: 'in_progress',
      attempt: creatingAttempt(),
    });

    await service.start('user-1', {});

    expect(mercadoPago.createPreferenceOutcome).not.toHaveBeenCalled();
    expect(attempts.markFailed).not.toHaveBeenCalled();
  });

  it('marks UNKNOWN after an ambiguous timeout and does not create another preference', async () => {
    billing.createOrder.mockResolvedValue({
      id: 'order-1',
      amountMinor: 4990,
      currency: 'BRL',
    });
    attempts.acquire.mockResolvedValue({
      outcome: 'acquired',
      attempt: creatingAttempt(),
    });
    mercadoPago.createPreferenceOutcome.mockResolvedValue({
      ok: false,
      failure: 'ambiguous',
      errorCode: 'timeout',
      message: 'Mercado Pago request timed out',
    });

    const result = await service.start('user-1', {});

    expect(attempts.markUnknown).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'attempt-1',
        errorCode: 'timeout',
      }),
    );
    expect(attempts.markFailed).not.toHaveBeenCalled();
    expect(result.outcome).toBe('reconciliation_required');
    expect(result.checkoutUrl).toBeNull();
  });

  it('marks FAILED only for a definitive provider rejection', async () => {
    billing.createOrder.mockResolvedValue({
      id: 'order-1',
      amountMinor: 4990,
      currency: 'BRL',
    });
    attempts.acquire.mockResolvedValue({
      outcome: 'acquired',
      attempt: creatingAttempt(),
    });
    mercadoPago.createPreferenceOutcome.mockResolvedValue({
      ok: false,
      failure: 'definitive',
      errorCode: 'bad_request',
      message: 'invalid payload',
    });

    await expect(service.start('user-1', {})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(attempts.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'attempt-1',
        errorCode: 'bad_request',
      }),
    );
    expect(attempts.markUnknown).not.toHaveBeenCalled();
  });

  it('creates BillingPayment and READY through completeReady', async () => {
    billing.createOrder.mockResolvedValue({
      id: 'order-1',
      amountMinor: 4990,
      currency: 'BRL',
    });
    attempts.acquire.mockResolvedValue({
      outcome: 'acquired',
      attempt: creatingAttempt(),
    });
    mercadoPago.createPreferenceOutcome.mockResolvedValue({
      ok: true,
      id: 'pref-1',
      initPoint: 'https://www.mercadopago.com.br/checkout/pref-1',
    });
    attempts.completeReady.mockImplementation(
      async (
        _input: unknown,
        persist: (
          tx: unknown,
          attempt: unknown,
        ) => Promise<{ paymentId: string; result: unknown }>,
      ) => (await persist({}, creatingAttempt())).result,
    );
    billing.attachCheckoutInTx.mockResolvedValue({
      paymentId: 'pay-1',
      view: {
        orderId: 'order-1',
        checkoutUrl: 'https://www.mercadopago.com.br/checkout/pref-1',
        amountMinor: 4990,
        currency: 'BRL',
        status: 'PENDING',
      },
    });

    await service.start('user-1', {});

    expect(billing.attachCheckoutInTx).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        orderId: 'order-1',
        providerCheckoutId: 'pref-1',
      }),
    );
    expect(attempts.completeReady).toHaveBeenCalled();
  });

  it('does not leave READY when local persistence fails after a created preference', async () => {
    billing.createOrder.mockResolvedValue({
      id: 'order-1',
      amountMinor: 4990,
      currency: 'BRL',
    });
    attempts.acquire.mockResolvedValue({
      outcome: 'acquired',
      attempt: creatingAttempt(),
    });
    mercadoPago.createPreferenceOutcome.mockResolvedValue({
      ok: true,
      id: 'pref-1',
      initPoint: 'https://www.mercadopago.com.br/checkout/pref-1',
    });
    attempts.completeReady.mockRejectedValue(new Error('db write failed'));

    const result = await service.start('user-1', {});

    expect(result.outcome).toBe('reconciliation_required');
    expect(attempts.markUnknown).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'attempt-1',
        errorCode: 'local_persist_failed',
      }),
    );
    expect(attempts.markFailed).not.toHaveBeenCalled();
  });

  it('blocks a new preference while UNKNOWN requires reconciliation', async () => {
    billing.createOrder.mockResolvedValue({
      id: 'order-1',
      amountMinor: 4990,
      currency: 'BRL',
    });
    attempts.acquire.mockResolvedValue({
      outcome: 'reconciliation_required',
      attempt: { ...creatingAttempt(), state: 'UNKNOWN' },
    });

    const result = await service.start('user-1', {});

    expect(result).toMatchObject({
      outcome: 'reconciliation_required',
      status: 'RECONCILIATION_REQUIRED',
      checkoutUrl: null,
    });
    expect(mercadoPago.createPreferenceOutcome).not.toHaveBeenCalled();
  });

  it('reuses an open checkout only after current collector ownership is confirmed', async () => {
    billing.findOpenCheckout.mockResolvedValue({
      orderId: 'order-1',
      checkoutUrl: 'https://www.mercadopago.com.br/checkout/pref-current',
      providerCheckoutId: 'pref-current',
      amountMinor: 4990,
      currency: 'BRL',
      status: 'PENDING',
    });
    mercadoPago.canReusePreference.mockResolvedValue(true);

    const result = await service.start('user-1', {});

    expect(mercadoPago.canReusePreference).toHaveBeenCalledWith('pref-current');
    expect(result).toEqual({
      outcome: 'ready',
      orderId: 'order-1',
      checkoutUrl: 'https://www.mercadopago.com.br/checkout/pref-current',
      amountMinor: 4990,
      currency: 'BRL',
      status: 'PENDING',
    });
    expect(attempts.acquire).not.toHaveBeenCalled();
    expect(mercadoPago.createPreferenceOutcome).not.toHaveBeenCalled();
    expect(billing.attachCheckoutInTx).not.toHaveBeenCalled();
  });

  it.each([
    ['different collector'],
    ['provider HTTP 401'],
    ['provider network error'],
  ])(
    'creates a new preference on the existing pending order when reuse validation fails: %s',
    async () => {
      billing.findOpenCheckout.mockResolvedValue({
        orderId: 'order-1',
        checkoutUrl: 'https://sandbox.mercadopago.com/checkout/pref-old',
        providerCheckoutId: 'pref-old',
        amountMinor: 4990,
        currency: 'BRL',
        status: 'PENDING',
      });
      mercadoPago.canReusePreference.mockResolvedValue(false);
      billing.findPendingBrazilOrder.mockResolvedValue({
        id: 'order-1',
        amountMinor: 4990,
        currency: 'BRL',
        status: 'PENDING',
      });
      attempts.acquire.mockResolvedValue({
        outcome: 'acquired',
        attempt: creatingAttempt(),
      });
      mercadoPago.createPreferenceOutcome.mockResolvedValue({
        ok: true,
        id: 'pref-new',
        initPoint: 'https://www.mercadopago.com.br/checkout/pref-new',
      });
      attempts.completeReady.mockImplementation(
        async (
          _input: unknown,
          persist: (
            tx: unknown,
            attempt: unknown,
          ) => Promise<{ paymentId: string; result: unknown }>,
        ) => (await persist({}, creatingAttempt())).result,
      );
      billing.attachCheckoutInTx.mockResolvedValue({
        paymentId: 'pay-2',
        view: {
          orderId: 'order-1',
          checkoutUrl: 'https://www.mercadopago.com.br/checkout/pref-new',
          amountMinor: 4990,
          currency: 'BRL',
          status: 'PENDING',
        },
      });

      await service.start('user-1', {});

      expect(billing.createOrder).not.toHaveBeenCalled();
      expect(mercadoPago.createPreferenceOutcome).toHaveBeenCalledWith({
        orderId: 'order-1',
        amountMinor: 4990,
      });
      expect(billing.attachCheckoutInTx).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          orderId: 'order-1',
          providerCheckoutId: 'pref-new',
        }),
      );
    },
  );

  it('does not reuse a checkout URL without a stored preference id', async () => {
    billing.findOpenCheckout.mockResolvedValue({
      orderId: 'order-1',
      checkoutUrl: 'https://sandbox.mercadopago.com/checkout/unknown',
      providerCheckoutId: null,
      amountMinor: 4990,
      currency: 'BRL',
      status: 'PENDING',
    });
    billing.findPendingBrazilOrder.mockResolvedValue({
      id: 'order-1',
      amountMinor: 4990,
      currency: 'BRL',
    });
    attempts.acquire.mockResolvedValue({
      outcome: 'acquired',
      attempt: creatingAttempt(),
    });
    mercadoPago.createPreferenceOutcome.mockResolvedValue({
      ok: true,
      id: 'pref-new',
      initPoint: 'https://www.mercadopago.com.br/checkout/pref-new',
    });
    attempts.completeReady.mockResolvedValue({
      outcome: 'ready',
      orderId: 'order-1',
      checkoutUrl: 'https://www.mercadopago.com.br/checkout/pref-new',
      amountMinor: 4990,
      currency: 'BRL',
      status: 'PENDING',
    });

    await service.start('user-1', {});

    expect(mercadoPago.canReusePreference).not.toHaveBeenCalled();
    expect(attempts.acquire).toHaveBeenCalled();
    expect(billing.createOrder).not.toHaveBeenCalled();
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
    expect(attempts.acquire).not.toHaveBeenCalled();
    expect(mercadoPago.createPreferenceOutcome).not.toHaveBeenCalled();
  });

  it('does not charge an ADMIN who already has staff Premium access', async () => {
    billing.getPremium.mockResolvedValue({
      ...inactivePremium(),
      access: true,
      channel: 'staff',
    });

    await expect(service.start('admin-1', {})).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(billing.createOrder).not.toHaveBeenCalled();
    expect(mercadoPago.createPreferenceOutcome).not.toHaveBeenCalled();
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
      providerCheckoutId: 'pref-old',
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

  it('reconciles a late payment for an older UNKNOWN preference without discarding it', async () => {
    mercadoPago.getPayment.mockResolvedValue(payment());
    billing.findOrderForProvider.mockResolvedValue({
      id: 'order-1',
      amountMinor: 4990,
      currency: 'BRL',
    });
    attempts.listByOrder.mockResolvedValue([
      {
        id: 'attempt-old',
        state: 'UNKNOWN',
        providerCheckoutId: 'pref-old',
        generation: 1,
      },
      {
        id: 'attempt-new',
        state: 'READY',
        providerCheckoutId: 'pref-new',
        generation: 2,
      },
    ]);
    billing.findPaymentByProvider.mockResolvedValue({ id: 'pay-old' });

    await service.handleWebhook(signed('9001'));

    expect(billing.applyProviderEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PAYMENT_PAID', orderId: 'order-1' }),
    );
    expect(attempts.reconcileUnknown).toHaveBeenCalledWith({
      id: 'attempt-old',
      outcome: 'READY',
      providerCheckoutId: 'pref-old',
      billingPaymentId: 'pay-old',
    });
  });

  it('forwards a missing preference id instead of binding the newest checkout', async () => {
    mercadoPago.getPayment.mockResolvedValue(payment({ preferenceId: null }));
    billing.findOrderForProvider.mockResolvedValue({
      id: 'order-1',
      amountMinor: 4990,
      currency: 'BRL',
    });

    await service.handleWebhook(signed('9001'));

    expect(billing.applyProviderEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        providerPaymentId: '9001',
        providerCheckoutId: null,
      }),
    );
  });
});

/**
 * These cases mock reservation outcomes. They do not prove PostgreSQL
 * advisory-lock serialization, partial unique indexes or real checkout
 * races across API instances.
 */
