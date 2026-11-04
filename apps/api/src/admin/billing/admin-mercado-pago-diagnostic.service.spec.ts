import { NotFoundException } from '@nestjs/common';
import { AdminMercadoPagoDiagnosticService } from './admin-mercado-pago-diagnostic.service';

describe('AdminMercadoPagoDiagnosticService', () => {
  const mercadoPago = {
    config: jest.fn(() => ({ sandbox: false })),
    inspectAuthenticatedCollector: jest.fn(),
    inspectPixPaymentMethods: jest.fn(),
    inspectPreferenceForDiagnostic: jest.fn(),
  };
  const prisma = {
    billingPayment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(async () => 2),
    },
  };

  let service: AdminMercadoPagoDiagnosticService;
  let previousFlag: string | undefined;

  function preferenceLookup(collectorId = 123456789) {
    return {
      ok: true,
      httpStatus: 200,
      errorCode: null,
      message: null,
      data: {
        collectorId,
        preferenceCreatedAt: '2026-10-30T12:00:00.000Z',
        paymentMethods: {
          excludedPaymentMethods: [],
          excludedPaymentTypes: [],
          defaultPaymentMethodId: null,
          installments: null,
        },
        excludedPaymentMethods: [],
        excludedPaymentTypes: [],
      },
    };
  }

  function paymentRow(input: {
    paymentId?: string;
    preferenceId: string;
    userId: string;
    createdAt: string;
  }) {
    const paymentId = input.paymentId ?? `pay-${input.preferenceId}`;
    return {
      id: paymentId,
      providerCheckoutId: input.preferenceId,
      createdAt: new Date(input.createdAt),
      status: 'PENDING',
      order: {
        userId: input.userId,
        status: 'PENDING',
      },
    };
  }

  function mockOpenCheckoutSnapshots(
    map: Record<
      string,
      {
        paymentId: string;
        preferenceId: string | null;
        checkoutUrl?: string;
      } | null
    >,
    latestStoredPreferenceId = 'pref-abc',
  ) {
    prisma.billingPayment.findFirst.mockImplementation(
      async (args: {
        where?: { provider?: string; order?: { userId?: string } };
      }) => {
        if (args?.where?.provider) {
          return { providerCheckoutId: latestStoredPreferenceId };
        }
        const userId = args?.where?.order?.userId;
        if (!userId || !(userId in map)) {
          return null;
        }
        const snapshot = map[userId];
        if (!snapshot) {
          return null;
        }
        return {
          id: snapshot.paymentId,
          checkoutUrl: snapshot.checkoutUrl ?? 'https://example.test/checkout',
          providerCheckoutId: snapshot.preferenceId,
        };
      },
    );
  }

  beforeEach(() => {
    previousFlag = process.env.ENABLE_MERCADO_PAGO_ADMIN_DIAGNOSTIC;
    process.env.ENABLE_MERCADO_PAGO_ADMIN_DIAGNOSTIC = 'true';
    jest.clearAllMocks();
    mercadoPago.config.mockReturnValue({ sandbox: false });
    mercadoPago.inspectAuthenticatedCollector.mockResolvedValue({
      ok: true,
      httpStatus: 200,
      errorCode: null,
      message: null,
      data: { collectorId: 123456789 },
    });
    mercadoPago.inspectPixPaymentMethods.mockResolvedValue({
      ok: true,
      httpStatus: 200,
      errorCode: null,
      message: null,
      data: {
        outcome: 'valid_with_pix',
        paymentMethodCount: 2,
        pixPaymentMethods: [
          { id: 'pix', payment_type_id: 'bank_transfer', status: 'active' },
        ],
        sample: [
          { id: 'pix', payment_type_id: 'bank_transfer', status: 'active' },
          { id: 'visa', payment_type_id: 'credit_card', status: 'active' },
        ],
        sampleTruncated: false,
      },
    });
    mercadoPago.inspectPreferenceForDiagnostic.mockResolvedValue(
      preferenceLookup(),
    );
    prisma.billingPayment.count.mockResolvedValue(2);
    prisma.billingPayment.findMany.mockResolvedValue([]);
    mockOpenCheckoutSnapshots({
      'user-default': {
        paymentId: 'pay-pref-abc',
        preferenceId: 'pref-abc',
      },
    });
    service = new AdminMercadoPagoDiagnosticService(
      mercadoPago as never,
      prisma as never,
    );
  });

  afterEach(() => {
    if (previousFlag === undefined) {
      delete process.env.ENABLE_MERCADO_PAGO_ADMIN_DIAGNOSTIC;
    } else {
      process.env.ENABLE_MERCADO_PAGO_ADMIN_DIAGNOSTIC = previousFlag;
    }
  });

  it('returns 404 when the temporary flag is disabled', async () => {
    process.env.ENABLE_MERCADO_PAGO_ADMIN_DIAGNOSTIC = 'false';
    await expect(service.run()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns a sanitized diagnostic view when every lookup succeeds', async () => {
    const result = await service.run();
    expect(result.temporary).toBe(true);
    expect(result.diagnosticSchemaVersion).toBe(2);
    expect(result.configured).toBe(true);
    expect(result.productionCheckoutMode).toBe(true);
    expect(result.collectorId).toBe(123456789);
    expect(result.paymentMethodsOutcome).toBe('valid_with_pix');
    expect(result.pixPaymentMethods).toEqual([
      { id: 'pix', payment_type_id: 'bank_transfer', status: 'active' },
    ]);
    expect(result.latestPreference).toEqual({
      preferenceId: 'pref-abc',
      collectorId: 123456789,
      matchesAuthenticatedCollector: true,
    });
    expect(result.reusablePendingCheckouts).toBe(2);
    expect(result.reusablePreferences?.listedCount).toBe(0);
    expect(result.reusablePreferences?.listingNote).toContain('four newest');
    expect(result.failedSteps).toEqual([]);
    expect(result.steps.map((step) => step.id)).toEqual([
      'config',
      'users_me',
      'payment_methods',
      'reusable_preferences',
      'latest_preference',
      'reusable_pending_checkouts',
    ]);
    expect(JSON.stringify(result)).not.toMatch(/APP_USR-|TEST-|eyJ/);
    expect(mercadoPago.inspectPreferenceForDiagnostic).toHaveBeenCalledTimes(1);
    expect(mercadoPago.inspectPreferenceForDiagnostic).toHaveBeenCalledWith(
      'pref-abc',
      expect.any(Number),
    );
  });

  it('keeps later lookups when users/me fails', async () => {
    mercadoPago.inspectAuthenticatedCollector.mockResolvedValue({
      ok: false,
      httpStatus: 404,
      errorCode: 'not_found',
      message: 'not found',
      data: null,
    });

    const result = await service.run();

    expect(result.collectorId).toBeNull();
    expect(result.failedSteps).toContain('users_me');
    expect(result.pixPaymentMethods).toHaveLength(1);
    expect(result.latestPreference?.preferenceId).toBe('pref-abc');
    expect(result.reusablePendingCheckouts).toBe(2);
    expect(mercadoPago.inspectPixPaymentMethods).toHaveBeenCalled();
    expect(mercadoPago.inspectPreferenceForDiagnostic).toHaveBeenCalledWith(
      'pref-abc',
      expect.any(Number),
    );
  });

  it('keeps collector data when payment_methods fails', async () => {
    mercadoPago.inspectPixPaymentMethods.mockResolvedValue({
      ok: false,
      httpStatus: 401,
      errorCode: 'unauthorized',
      message: 'invalid access token [redacted]',
      data: {
        outcome: 'http_error',
        paymentMethodCount: 0,
        pixPaymentMethods: [],
        sample: [],
        sampleTruncated: false,
      },
    });

    const result = await service.run();

    expect(result.collectorId).toBe(123456789);
    expect(result.pixPaymentMethods).toEqual([]);
    expect(result.paymentMethodsOutcome).toBe('http_error');
    expect(result.failedSteps).toContain('payment_methods');
    expect(result.failedSteps).not.toContain('users_me');
    expect(result.latestPreference?.matchesAuthenticatedCollector).toBe(true);
  });

  it('does not treat a valid catalog without Pix as a failed step', async () => {
    mercadoPago.inspectPixPaymentMethods.mockResolvedValue({
      ok: true,
      httpStatus: 200,
      errorCode: null,
      message: null,
      data: {
        outcome: 'valid_without_pix',
        paymentMethodCount: 1,
        pixPaymentMethods: [],
        sample: [
          { id: 'visa', payment_type_id: 'credit_card', status: 'active' },
        ],
        sampleTruncated: false,
      },
    });

    const result = await service.run();

    expect(result.paymentMethodsOutcome).toBe('valid_without_pix');
    expect(result.pixPaymentMethods).toEqual([]);
    expect(result.failedSteps).not.toContain('payment_methods');
  });

  it('keeps other steps when the preference lookup fails', async () => {
    mercadoPago.inspectPreferenceForDiagnostic.mockResolvedValue({
      ok: false,
      httpStatus: 404,
      errorCode: 'not_found',
      message: 'preference not found',
      data: null,
    });

    const result = await service.run();

    expect(result.collectorId).toBe(123456789);
    expect(result.failedSteps).toContain('latest_preference');
    expect(result.latestPreference).toEqual({
      preferenceId: 'pref-abc',
      collectorId: null,
      matchesAuthenticatedCollector: null,
    });
    expect(result.reusablePendingCheckouts).toBe(2);
  });

  it('does not fail the whole diagnostic when Prisma preference lookup fails', async () => {
    prisma.billingPayment.findFirst.mockRejectedValueOnce(new Error('db down'));

    const result = await service.run();

    expect(result.collectorId).toBe(123456789);
    expect(result.failedSteps).toContain('latest_preference');
    expect(result.reusablePendingCheckouts).toBe(2);
  });

  it('reports reusable pending checkouts even when Mercado Pago is unreachable', async () => {
    mercadoPago.inspectAuthenticatedCollector.mockRejectedValue(
      new Error('boom'),
    );
    mercadoPago.inspectPixPaymentMethods.mockRejectedValue(new Error('boom'));
    mercadoPago.inspectPreferenceForDiagnostic.mockRejectedValue(
      new Error('boom'),
    );

    const result = await service.run();

    expect(result.failedSteps).toEqual(
      expect.arrayContaining([
        'users_me',
        'payment_methods',
        'latest_preference',
      ]),
    );
    expect(result.paymentMethodsOutcome).toBe('unexpected_error');
    expect(result.reusablePendingCheckouts).toBe(2);
    expect(result.pixCatalogNote).toContain('does not prove');
  });

  it('inspects up to four reusable preferences and flags the active open checkout per owner', async () => {
    prisma.billingPayment.count.mockResolvedValue(4);
    prisma.billingPayment.findMany.mockResolvedValue([
      paymentRow({
        preferenceId: 'pref-1',
        userId: 'user-1',
        createdAt: '2026-10-30T12:00:00.000Z',
      }),
      paymentRow({
        preferenceId: 'pref-1-old',
        userId: 'user-1',
        createdAt: '2026-10-29T12:00:00.000Z',
      }),
      paymentRow({
        preferenceId: 'pref-2',
        userId: 'user-2',
        createdAt: '2026-10-28T12:00:00.000Z',
      }),
      paymentRow({
        preferenceId: 'pref-3',
        userId: 'user-3',
        createdAt: '2026-10-27T12:00:00.000Z',
      }),
    ]);
    mockOpenCheckoutSnapshots(
      {
        'user-1': { paymentId: 'pay-pref-1', preferenceId: 'pref-1' },
        'user-2': { paymentId: 'pay-pref-2', preferenceId: 'pref-2' },
        'user-3': { paymentId: 'pay-pref-3', preferenceId: 'pref-3' },
      },
      'pref-1',
    );

    const result = await service.run();
    const items = result.reusablePreferences?.items ?? [];

    expect(prisma.billingPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 4,
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(items).toHaveLength(4);
    expect(items.map((item) => item.preferenceId)).toEqual([
      'pref-1',
      'pref-1-old',
      'pref-2',
      'pref-3',
    ]);
    expect(items[0]).toMatchObject({
      itemKey: 'item-1',
      reuseOwnerKey: 'owner-a',
      openCheckoutReuseMatch: 'active',
      isActiveOpenCheckout: true,
      paymentStatus: 'PENDING',
      orderStatus: 'PENDING',
    });
    expect(items[1]).toMatchObject({
      itemKey: 'item-2',
      reuseOwnerKey: 'owner-a',
      openCheckoutReuseMatch: 'not_active',
      isActiveOpenCheckout: false,
    });
    expect(items[2]).toMatchObject({
      reuseOwnerKey: 'owner-b',
      openCheckoutReuseMatch: 'active',
      isActiveOpenCheckout: true,
    });
    expect(items[3]).toMatchObject({
      reuseOwnerKey: 'owner-c',
      openCheckoutReuseMatch: 'active',
      isActiveOpenCheckout: true,
    });
    expect(result.reusablePreferences?.reuseOwnerCount).toBe(3);
    expect(result.latestPreference?.preferenceId).toBe('pref-1');
    expect(mercadoPago.inspectPreferenceForDiagnostic).toHaveBeenCalledTimes(4);
    expect(mercadoPago.inspectPreferenceForDiagnostic).toHaveBeenCalledWith(
      'pref-1',
      expect.any(Number),
    );
    expect(mercadoPago.inspectPreferenceForDiagnostic).toHaveBeenCalledWith(
      'pref-1-old',
      expect.any(Number),
    );
    expect(JSON.stringify(result)).not.toMatch(/user-1|user-2|user-3/);
    expect(JSON.stringify(result)).not.toMatch(/orderId|userId|payer|@/);
  });

  it('keeps listing reusable preferences when one Mercado Pago GET fails', async () => {
    prisma.billingPayment.findMany.mockResolvedValue([
      paymentRow({
        preferenceId: 'pref-ok',
        userId: 'user-1',
        createdAt: '2026-10-30T12:00:00.000Z',
      }),
      paymentRow({
        preferenceId: 'pref-fail',
        userId: 'user-2',
        createdAt: '2026-10-29T12:00:00.000Z',
      }),
    ]);
    mockOpenCheckoutSnapshots({
      'user-1': { paymentId: 'pay-pref-ok', preferenceId: 'pref-ok' },
      'user-2': { paymentId: 'pay-pref-fail', preferenceId: 'pref-fail' },
    });
    mercadoPago.inspectPreferenceForDiagnostic.mockImplementation(
      async (preferenceId: string) => {
        if (preferenceId === 'pref-fail') {
          return {
            ok: false,
            httpStatus: 500,
            errorCode: 'internal_error',
            message:
              'preference lookup failed for payer: buyer@example.com https://api.mercadopago.com',
            data: null,
          };
        }
        return preferenceLookup();
      },
    );

    const result = await service.run();

    expect(result.failedSteps).not.toContain('reusable_preferences');
    expect(result.reusablePreferences?.partialFailures).toBe(1);
    expect(result.reusablePreferences?.items[0].mercadoPago.ok).toBe(true);
    expect(result.reusablePreferences?.items[1].mercadoPago).toMatchObject({
      ok: false,
      httpStatus: 500,
      errorCode: 'internal_error',
      skipped: false,
    });
    expect(
      JSON.stringify(result.reusablePreferences?.items[1].mercadoPago),
    ).not.toMatch(/buyer@|https:\/\//);
    expect(result.latestPreference?.preferenceId).toBe('pref-abc');
    expect(result.latestPreference?.matchesAuthenticatedCollector).toBe(true);
  });

  it('does not query Mercado Pago twice when the latest preference is already listed', async () => {
    prisma.billingPayment.findMany.mockResolvedValue([
      paymentRow({
        preferenceId: 'pref-abc',
        userId: 'user-1',
        createdAt: '2026-10-30T12:00:00.000Z',
      }),
    ]);
    mockOpenCheckoutSnapshots({
      'user-1': { paymentId: 'pay-pref-abc', preferenceId: 'pref-abc' },
    });
    prisma.billingPayment.findFirst.mockImplementation(
      async (args: { where?: { provider?: string } }) => {
        if (args?.where?.provider) {
          return { providerCheckoutId: 'pref-abc' };
        }
        return {
          id: 'pay-pref-abc',
          checkoutUrl: 'https://example.test/checkout',
          providerCheckoutId: 'pref-abc',
        };
      },
    );

    await service.run();

    expect(mercadoPago.inspectPreferenceForDiagnostic).toHaveBeenCalledTimes(1);
    expect(mercadoPago.inspectPreferenceForDiagnostic).toHaveBeenCalledWith(
      'pref-abc',
      expect.any(Number),
    );
  });

  it('marks reuse as inconclusive when checkoutUrl reuse has no preference id', async () => {
    prisma.billingPayment.findMany.mockResolvedValue([
      paymentRow({
        paymentId: 'pay-listed-old',
        preferenceId: 'pref-old',
        userId: 'user-1',
        createdAt: '2026-10-29T12:00:00.000Z',
      }),
    ]);
    mockOpenCheckoutSnapshots({
      'user-1': {
        paymentId: 'pay-listed-old',
        preferenceId: null,
      },
    });

    const result = await service.run();
    const item = result.reusablePreferences?.items[0];

    expect(item).toMatchObject({
      openCheckoutReuseMatch: 'inconclusive',
      isActiveOpenCheckout: null,
    });
  });

  it('marks listed preferences inconclusive when the active checkout is not among the four listed rows', async () => {
    prisma.billingPayment.findMany.mockResolvedValue([
      paymentRow({
        paymentId: 'pay-listed-stale',
        preferenceId: 'pref-stale',
        userId: 'user-1',
        createdAt: '2026-10-29T12:00:00.000Z',
      }),
    ]);
    mockOpenCheckoutSnapshots({
      'user-1': {
        paymentId: 'pay-active-not-listed',
        preferenceId: 'pref-active',
      },
    });

    const result = await service.run();

    expect(result.reusablePreferences?.items[0]).toMatchObject({
      openCheckoutReuseMatch: 'inconclusive',
      isActiveOpenCheckout: null,
    });
  });

  it('reports valid_empty_catalog without treating it as a failed step', async () => {
    mercadoPago.inspectPixPaymentMethods.mockResolvedValue({
      ok: true,
      httpStatus: 200,
      errorCode: null,
      message: null,
      data: {
        outcome: 'valid_empty_catalog',
        paymentMethodCount: 0,
        pixPaymentMethods: [],
        sample: [],
        sampleTruncated: false,
      },
    });

    const result = await service.run();

    expect(result.paymentMethodsOutcome).toBe('valid_empty_catalog');
    expect(result.failedSteps).not.toContain('payment_methods');
  });

  it('skips further preference GET calls after the reusable preference budget is exhausted', async () => {
    jest.useFakeTimers();
    prisma.billingPayment.count.mockResolvedValue(4);
    prisma.billingPayment.findMany.mockResolvedValue([
      paymentRow({
        preferenceId: 'pref-1',
        userId: 'user-1',
        createdAt: '2026-10-30T12:00:00.000Z',
      }),
      paymentRow({
        preferenceId: 'pref-2',
        userId: 'user-2',
        createdAt: '2026-10-29T12:00:00.000Z',
      }),
      paymentRow({
        preferenceId: 'pref-3',
        userId: 'user-3',
        createdAt: '2026-10-28T12:00:00.000Z',
      }),
      paymentRow({
        preferenceId: 'pref-4',
        userId: 'user-4',
        createdAt: '2026-10-27T12:00:00.000Z',
      }),
    ]);
    prisma.billingPayment.findFirst.mockImplementation(
      async (args: {
        where?: { provider?: string; order?: { userId?: string } };
      }) => {
        if (args?.where?.provider) {
          return { providerCheckoutId: 'pref-3' };
        }
        const userId = args?.where?.order?.userId;
        const snapshots: Record<
          string,
          { paymentId: string; preferenceId: string | null }
        > = {
          'user-1': { paymentId: 'pay-pref-1', preferenceId: 'pref-1' },
          'user-2': { paymentId: 'pay-pref-2', preferenceId: 'pref-2' },
          'user-3': { paymentId: 'pay-pref-3', preferenceId: 'pref-3' },
          'user-4': { paymentId: 'pay-pref-4', preferenceId: 'pref-4' },
        };
        const snapshot = userId ? snapshots[userId] : undefined;
        if (!snapshot) {
          return null;
        }
        return {
          id: snapshot.paymentId,
          checkoutUrl: 'https://example.test/checkout',
          providerCheckoutId: snapshot.preferenceId,
        };
      },
    );
    mercadoPago.inspectPreferenceForDiagnostic.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(preferenceLookup()), 10_000);
        }),
    );

    const runPromise = service.run();
    await jest.advanceTimersByTimeAsync(40_000);
    const result = await runPromise;

    expect(mercadoPago.inspectPreferenceForDiagnostic).toHaveBeenCalledTimes(3);
    expect(result.reusablePreferences?.items[3].mercadoPago).toMatchObject({
      errorCode: 'budget_exceeded',
      skipped: true,
      ok: false,
    });
    jest.useRealTimers();
  });

  it('uses cached preference lookups without issuing another GET', async () => {
    prisma.billingPayment.findMany.mockResolvedValue([
      paymentRow({
        preferenceId: 'pref-shared',
        userId: 'user-1',
        createdAt: '2026-10-30T12:00:00.000Z',
      }),
      paymentRow({
        preferenceId: 'pref-shared',
        userId: 'user-2',
        createdAt: '2026-10-29T12:00:00.000Z',
      }),
    ]);
    mockOpenCheckoutSnapshots({
      'user-1': { paymentId: 'pay-pref-shared', preferenceId: 'pref-shared' },
      'user-2': { paymentId: 'pay-pref-shared', preferenceId: 'pref-shared' },
    });
    prisma.billingPayment.findFirst.mockImplementation(
      async (args: { where?: { provider?: string } }) => {
        if (args?.where?.provider) {
          return { providerCheckoutId: 'pref-shared' };
        }
        return {
          id: 'pay-pref-shared',
          checkoutUrl: 'https://example.test/checkout',
          providerCheckoutId: 'pref-shared',
        };
      },
    );

    await service.run();

    expect(mercadoPago.inspectPreferenceForDiagnostic).toHaveBeenCalledTimes(1);
  });
});
