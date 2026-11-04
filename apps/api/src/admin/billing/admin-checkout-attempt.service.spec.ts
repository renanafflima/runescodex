import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminAuditService } from '../../audit/admin-audit.service';
import { BillingCheckoutAttemptService } from '../../billing/billing-checkout-attempt.service';
import { BillingService } from '../../billing/billing.service';
import { MercadoPagoClient } from '../../billing/mercado-pago.client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminCheckoutAttemptService } from './admin-checkout-attempt.service';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('AdminCheckoutAttemptService', () => {
  const attempts = {
    getById: jest.fn(),
    reconcileUnknown: jest.fn(),
  };
  const billing = {
    attachCheckout: jest.fn(),
  };
  const mercadoPago = {
    lookupPreference: jest.fn(),
    searchPayments: jest.fn(),
  };
  const prisma = {
    billingPayment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  const audit = {
    record: jest.fn(),
  };
  let service: AdminCheckoutAttemptService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mercadoPago.searchPayments.mockResolvedValue([]);
    prisma.billingPayment.findMany.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminCheckoutAttemptService,
        { provide: PrismaService, useValue: prisma },
        { provide: BillingCheckoutAttemptService, useValue: attempts },
        { provide: BillingService, useValue: billing },
        { provide: MercadoPagoClient, useValue: mercadoPago },
        { provide: AdminAuditService, useValue: audit },
      ],
    }).compile();
    service = moduleRef.get(AdminCheckoutAttemptService);
  });

  function unknownAttempt(overrides = {}) {
    return {
      id: 'attempt-1',
      orderId: 'order-1',
      userId: 'user-1',
      generation: 1,
      state: 'UNKNOWN',
      providerCheckoutId: 'pref-1',
      billingPaymentId: null,
      lastErrorCode: 'timeout',
      completedAt: new Date(),
      ...overrides,
    };
  }

  it('recommends READY when a local payment matches the preference', async () => {
    attempts.getById.mockResolvedValue(
      unknownAttempt({ billingPaymentId: 'pay-1' }),
    );
    prisma.billingPayment.findMany.mockResolvedValue([
      {
        id: 'pay-1',
        providerCheckoutId: 'pref-1',
        providerPaymentId: '9001',
        status: 'PENDING',
      },
    ]);
    mercadoPago.lookupPreference.mockResolvedValue({
      status: 'found',
      httpStatus: 200,
      collectorId: 1,
      initPoint: 'https://www.mercadopago.com.br/checkout/pref-1',
    });

    const view = await service.inspect('attempt-1');

    expect(view.evidence.recommended).toBe('READY');
    expect(JSON.stringify(view)).not.toMatch(/APP_USR-|eyJ[A-Za-z0-9_-]+\./);
    expect(JSON.stringify(view.evidence)).not.toContain('initPoint');
    expect(billing.attachCheckout).not.toHaveBeenCalled();
  });

  it('recommends FAILED only when the preference is absent and unpaid', async () => {
    attempts.getById.mockResolvedValue(unknownAttempt());
    mercadoPago.lookupPreference.mockResolvedValue({
      status: 'not_found',
      httpStatus: 404,
      collectorId: null,
      initPoint: null,
    });

    const view = await service.inspect('attempt-1');

    expect(view.evidence.recommended).toBe('FAILED');
    expect(view.evidence.preferenceLookup).toBe('not_found');
  });

  it('keeps UNKNOWN when Mercado Pago lookup is inconclusive', async () => {
    attempts.getById.mockResolvedValue(unknownAttempt());
    mercadoPago.lookupPreference.mockResolvedValue({
      status: 'inconclusive',
      httpStatus: null,
      collectorId: null,
      initPoint: null,
    });

    const view = await service.inspect('attempt-1');

    expect(view.evidence.recommended).toBe('UNKNOWN');
    await expect(
      service.reconcile('admin-1', 'attempt-1', {
        outcome: 'FAILED',
        reason: 'timeout longo demais',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(attempts.reconcileUnknown).not.toHaveBeenCalled();
  });

  it('rejects READY without conclusive evidence', async () => {
    attempts.getById.mockResolvedValue(unknownAttempt());
    mercadoPago.lookupPreference.mockResolvedValue({
      status: 'inconclusive',
      httpStatus: 500,
      collectorId: null,
      initPoint: null,
    });

    await expect(
      service.reconcile('admin-1', 'attempt-1', {
        outcome: 'READY',
        reason: 'quero liberar mesmo assim',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('records audit when READY is allowed by a stored payment', async () => {
    attempts.getById.mockResolvedValue(
      unknownAttempt({ billingPaymentId: 'pay-1' }),
    );
    prisma.billingPayment.findMany.mockResolvedValue([
      {
        id: 'pay-1',
        providerCheckoutId: 'pref-1',
        providerPaymentId: null,
        status: 'PENDING',
      },
    ]);
    mercadoPago.lookupPreference.mockResolvedValue({
      status: 'found',
      httpStatus: 200,
      collectorId: 1,
      initPoint: 'https://www.mercadopago.com.br/checkout/pref-1',
    });
    attempts.reconcileUnknown.mockResolvedValue({
      id: 'attempt-1',
      state: 'READY',
    });

    await service.reconcile('admin-1', 'attempt-1', {
      outcome: 'READY',
      reason: 'preferencia confirmada no GET',
    });

    expect(attempts.reconcileUnknown).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'attempt-1',
        outcome: 'READY',
        billingPaymentId: 'pay-1',
      }),
    );
    expect(audit.record).toHaveBeenCalledTimes(1);
    const recorded = (
      audit.record.mock.calls as Array<
        [
          {
            actorUserId: string;
            action: string;
            metadata?: { reason?: string };
          },
        ]
      >
    )[0][0];
    expect(recorded.actorUserId).toBe('admin-1');
    expect(recorded.action).toBe('checkout.attempt.reconcile');
    expect(recorded.metadata?.reason).toBe('preferencia confirmada no GET');
  });

  it('rejects reconciliation of a non-UNKNOWN attempt', async () => {
    attempts.getById.mockResolvedValue(unknownAttempt({ state: 'READY' }));

    await expect(
      service.reconcile('admin-1', 'attempt-1', {
        outcome: 'FAILED',
        reason: 'tentativa invalida de transicao',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
