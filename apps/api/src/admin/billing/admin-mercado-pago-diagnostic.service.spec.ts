import { NotFoundException } from '@nestjs/common';
import { AdminMercadoPagoDiagnosticService } from './admin-mercado-pago-diagnostic.service';

describe('AdminMercadoPagoDiagnosticService', () => {
  const mercadoPago = {
    config: jest.fn(() => ({ sandbox: false })),
    getAuthenticatedCollectorId: jest.fn(async () => 123456789),
    listPixPaymentMethods: jest.fn(async () => [
      { id: 'pix', payment_type_id: 'bank_transfer', status: 'active' },
    ]),
    getPreferenceCollectorId: jest.fn(async () => 123456789),
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

  it('returns a sanitized diagnostic view', async () => {
    const result = await service.run();
    expect(result).toEqual({
      temporary: true,
      collectorId: 123456789,
      pixPaymentMethods: [
        { id: 'pix', payment_type_id: 'bank_transfer', status: 'active' },
      ],
      latestPreference: {
        preferenceId: 'pref-abc',
        collectorId: 123456789,
        matchesAuthenticatedCollector: true,
      },
      reusablePendingCheckouts: 2,
      productionCheckoutMode: true,
    });
    expect(mercadoPago.getAuthenticatedCollectorId).toHaveBeenCalled();
    expect(mercadoPago.listPixPaymentMethods).toHaveBeenCalled();
  });
});
