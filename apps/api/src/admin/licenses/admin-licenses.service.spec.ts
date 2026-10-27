import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { validate } from 'class-validator';
import { Test } from '@nestjs/testing';
import { AdminAuditService } from '../../audit/admin-audit.service';
import { BillingCheckoutService } from '../../billing/billing-checkout.service';
import { RedeemVoucherDto } from '../../billing/dto/redeem-voucher.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { GrantLicenseDto } from './admin-licenses.dto';
import { AdminLicensesService } from './admin-licenses.service';

describe('AdminLicensesService', () => {
  const audits: Array<Record<string, unknown>> = [];
  const payments = [
    {
      id: 'payment-1',
      provider: 'mercadopago',
      providerPaymentId: 'mp-1',
      status: 'PENDING',
      providerStatus: null,
      currency: 'BRL',
      amountMinor: 4990,
      createdAt: new Date('2026-10-20T00:00:00.000Z'),
      paidAt: null,
      refundedAt: null,
      syncedAt: null,
      order: {
        product: { code: 'RUNECODEX_PREMIUM' },
        license: null,
        user: { id: 'user-1', email: 'ada@example.com', activeCharacter: null },
      },
    },
  ];
  const prisma = {
    billingPayment: {
      findUnique: jest.fn(async () => payments[0]),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(payments[0], data);
        return payments[0];
      }),
    },
    billingLicense: {
      create: jest.fn(),
    },
    billingEventReceipt: {
      findMany: jest.fn(async () => []),
    },
  };
  const checkout = {
    reconcileProviderPayment: jest.fn(async () => ({
      providerStatus: 'pending',
      providerPaymentId: 'mp-1',
    })),
  };

  let service: AdminLicensesService;

  beforeEach(async () => {
    audits.length = 0;
    payments[0].status = 'PENDING';
    payments[0].providerStatus = null;
    prisma.billingLicense.create.mockClear();
    checkout.reconcileProviderPayment.mockClear();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminLicensesService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: AdminAuditService,
          useValue: {
            record: (input: Record<string, unknown>) => {
              audits.push(input);
            },
          },
        },
        { provide: BillingCheckoutService, useValue: checkout },
      ],
    }).compile();
    service = moduleRef.get(AdminLicensesService);
  });

  it('returns stored provider events and no payment secrets', async () => {
    prisma.billingEventReceipt.findMany.mockResolvedValueOnce([
      {
        id: 'event-1',
        type: 'PAYMENT_PAID',
        provider: 'mercadopago',
        createdAt: new Date('2026-10-20T01:00:00.000Z'),
      },
    ]);

    const detail = await service.paymentDetail('payment-1');

    expect(detail.events).toEqual([
      {
        id: 'event-1',
        type: 'PAYMENT_PAID',
        provider: 'mercadopago',
        createdAt: '2026-10-20T01:00:00.000Z',
      },
    ]);
    expect(detail.status).toBe('PENDING');
    expect(JSON.stringify(detail)).not.toMatch(
      /access_token|password|card_number/i,
    );
  });

  it('does not let an administrator mark a payment approved', async () => {
    expect(
      (service as unknown as { approvePayment?: unknown }).approvePayment,
    ).toBeUndefined();

    await service.syncPayment('admin-1', 'payment-1');

    expect(checkout.reconcileProviderPayment).toHaveBeenCalledWith('mp-1');
    expect(prisma.billingLicense.create).not.toHaveBeenCalled();
    expect(payments[0].status).toBe('PENDING');
    expect(payments[0].providerStatus).toBe('pending');
    expect(audits).toEqual([
      expect.objectContaining({
        action: 'payment.sync',
        actorUserId: 'admin-1',
        entityId: 'payment-1',
      }),
    ]);
  });
});

describe('administrative grants', () => {
  function harness() {
    const licenses: Array<Record<string, unknown>> = [];
    const grants: Array<Record<string, unknown>> = [];
    const audits: Array<Record<string, unknown>> = [];
    const tx = {
      billingLicense: {
        findFirst: async () =>
          licenses.find((row) => row.status === 'ACTIVE') ?? null,
        findUnique: async ({ where }: { where: { id: string } }) =>
          licenses.find((row) => row.id === where.id) ?? null,
        updateMany: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const row = licenses.find((item) => item.id === where.id);
          if (!row) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const row = licenses.find((item) => item.id === where.id);
          if (!row) throw new Error('missing');
          Object.assign(row, data);
          return row;
        },
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const row = {
            id: 'license-1',
            grantedAt: new Date('2026-10-20T00:00:00.000Z'),
            expiresAt: null,
            revokedAt: null,
            suspendedAt: null,
            orderId: null,
            ...data,
          };
          licenses.push(row);
          return row;
        },
      },
      billingLicenseGrant: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: 'grant-1', ...data };
          grants.push(row);
          return row;
        },
        updateMany: async ({ data }: { data: Record<string, unknown> }) => {
          for (const row of grants) Object.assign(row, data);
          return { count: grants.length };
        },
      },
    };
    const detailLicense = () => {
      const license = licenses[0];
      return {
        ...license,
        user: {
          id: 'user-1',
          email: 'ada@example.com',
          activeCharacter: { name: 'Ada' },
        },
        product: { code: 'RUNECODEX_PREMIUM', name: 'Premium' },
        order: null,
        redemption: null,
        grant: grants[0]
          ? {
              ...grants[0],
              revokedAt: grants[0].revokedAt ?? null,
              actor: {
                id: 'admin-1',
                email: 'admin@example.com',
                activeCharacter: null,
              },
            }
          : null,
      };
    };
    const prisma = {
      user: { findUnique: async () => ({ id: 'user-1' }) },
      billingProduct: {
        findUnique: async () => ({ id: 'product-1', active: true }),
      },
      billingPayment: { create: jest.fn() },
      billingLicense: {
        ...tx.billingLicense,
        findUnique: async () => detailLicense(),
      },
      adminAuditEvent: { findMany: async () => [] },
      $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx),
    };
    return { licenses, grants, audits, prisma };
  }

  async function build(state: ReturnType<typeof harness>) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminLicensesService,
        { provide: PrismaService, useValue: state.prisma },
        {
          provide: AdminAuditService,
          useValue: {
            record: (input: Record<string, unknown>) => {
              state.audits.push(input);
            },
          },
        },
        { provide: BillingCheckoutService, useValue: {} },
      ],
    }).compile();
    return moduleRef.get(AdminLicensesService);
  }

  it('grants a license without creating a payment and refuses a duplicate', async () => {
    const state = harness();
    const service = await build(state);
    const granted = await service.grant('admin-1', {
      userId: '5d5b8f2e-3c5a-4a1e-9c1a-0b9a6d5e4f11',
      term: 'LIFETIME',
      category: 'CONTENT_CREATOR',
      reason: 'Parceiro de conteúdo da temporada',
    });

    expect(state.prisma.billingPayment.create).not.toHaveBeenCalled();
    expect(state.licenses[0]).toMatchObject({
      source: 'ADMIN_GRANT',
      orderId: null,
      status: 'ACTIVE',
    });
    expect(state.grants[0]).toMatchObject({ category: 'CONTENT_CREATOR' });
    expect(state.audits[0]).toMatchObject({ action: 'license.grant' });
    expect(granted.email).toBe('ada@example.com');

    await expect(
      service.grant('admin-1', {
        userId: '5d5b8f2e-3c5a-4a1e-9c1a-0b9a6d5e4f11',
        term: 'LIFETIME',
        category: 'OTHER',
        reason: 'Segunda concessão indevida',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(state.licenses).toHaveLength(1);
  });

  it('suspends, blocks access, restores and then revokes without deleting history', async () => {
    const state = harness();
    const service = await build(state);
    await service.grant('admin-1', {
      userId: '5d5b8f2e-3c5a-4a1e-9c1a-0b9a6d5e4f11',
      term: 'LIFETIME',
      category: 'COLLABORATOR',
      reason: 'Colaborador interno do projeto',
    });

    await service.suspend('admin-1', 'license-1', {
      reason: 'Revisão temporária da conta',
    });
    expect(state.licenses[0]).toMatchObject({
      status: 'SUSPENDED',
      activeUserProductKey: '5d5b8f2e-3c5a-4a1e-9c1a-0b9a6d5e4f11:product-1',
    });

    await service.restore('admin-1', 'license-1', {
      reason: 'Revisão concluída sem problema',
    });
    expect(state.licenses[0]).toMatchObject({ status: 'ACTIVE' });

    await service.revoke('admin-1', 'license-1', {
      reason: 'Encerramento da colaboração',
    });
    expect(state.licenses).toHaveLength(1);
    expect(state.licenses[0]).toMatchObject({
      status: 'REVOKED',
      activeUserProductKey: null,
    });
    expect(state.grants[0]).toMatchObject({
      revokeReason: 'Encerramento da colaboração',
    });
    expect(state.audits.map((event) => event.action)).toEqual([
      'license.grant',
      'license.suspend',
      'license.restore',
      'license.revoke',
    ]);
  });

  it('rejects a grant whose justification is too short', async () => {
    const state = harness();
    const service = await build(state);
    await expect(
      service.grant('admin-1', {
        userId: '5d5b8f2e-3c5a-4a1e-9c1a-0b9a6d5e4f11',
        term: 'LIFETIME',
        category: 'OTHER',
        reason: 'curta',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(state.licenses).toHaveLength(0);
  });
});

describe('license input validation', () => {
  it('requires a justification before an administrative grant', async () => {
    const dto = new GrantLicenseDto();
    dto.userId = '5d5b8f2e-3c5a-4a1e-9c1a-0b9a6d5e4f11';
    dto.term = 'LIFETIME';
    dto.category = 'COLLABORATOR';
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'reason')).toBe(true);
  });

  it('rejects a redeem body that tries to name another account', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    await expect(
      pipe.transform(
        { code: 'RC-TEST-CODE-1234', email: 'other@example.com' },
        { type: 'body', metatype: RedeemVoucherDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
