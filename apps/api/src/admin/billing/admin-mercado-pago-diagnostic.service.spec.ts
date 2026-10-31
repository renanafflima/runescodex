import { NotFoundException } from '@nestjs/common';
import { AdminMercadoPagoDiagnosticService } from './admin-mercado-pago-diagnostic.service';

describe('AdminMercadoPagoDiagnosticService', () => {
  const mercadoPago = {
    config: jest.fn(() => ({ sandbox: false })),
    inspectAuthenticatedCollector: jest.fn(),
    inspectPixPaymentMethods: jest.fn(),
    inspectPreferenceCollector: jest.fn(),
  };
  const prisma = {
    billingPayment: {
      findFirst: jest.fn(async () => ({ providerCheckoutId: 'pref-abc' })),
      count: jest.fn(async () => 2),
    },
  };

  let service: AdminMercadoPagoDiagnosticService;
  let previousFlag: string | undefined;

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
        paymentMethodCount: 2,
        pixPaymentMethods: [
          { id: 'pix', payment_type_id: 'bank_transfer', status: 'active' },
        ],
      },
    });
    mercadoPago.inspectPreferenceCollector.mockResolvedValue({
      ok: true,
      httpStatus: 200,
      errorCode: null,
      message: null,
      data: { collectorId: 123456789 },
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
    expect(result.collectorId).toBe(123456789);
    expect(result.pixPaymentMethods).toEqual([
      { id: 'pix', payment_type_id: 'bank_transfer', status: 'active' },
    ]);
    expect(result.latestPreference).toEqual({
      preferenceId: 'pref-abc',
      collectorId: 123456789,
      matchesAuthenticatedCollector: true,
    });
    expect(result.reusablePendingCheckouts).toBe(2);
    expect(result.failedSteps).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(/APP_USR-|TEST-|eyJ/);
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
    expect(mercadoPago.inspectPreferenceCollector).toHaveBeenCalledWith(
      'pref-abc',
    );
  });

  it('keeps collector data when payment_methods fails', async () => {
    mercadoPago.inspectPixPaymentMethods.mockResolvedValue({
      ok: false,
      httpStatus: 401,
      errorCode: 'unauthorized',
      message: 'invalid access token [redacted]',
      data: null,
    });

    const result = await service.run();

    expect(result.collectorId).toBe(123456789);
    expect(result.pixPaymentMethods).toEqual([]);
    expect(result.failedSteps).toContain('payment_methods');
    expect(result.latestPreference?.matchesAuthenticatedCollector).toBe(true);
  });

  it('keeps other steps when the preference lookup fails', async () => {
    mercadoPago.inspectPreferenceCollector.mockResolvedValue({
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
    mercadoPago.inspectPreferenceCollector.mockRejectedValue(new Error('boom'));

    const result = await service.run();

    expect(result.failedSteps).toEqual(
      expect.arrayContaining(['users_me', 'payment_methods', 'latest_preference']),
    );
    expect(result.reusablePendingCheckouts).toBe(2);
    expect(result.pixCatalogNote).toContain('does not prove');
  });
});
