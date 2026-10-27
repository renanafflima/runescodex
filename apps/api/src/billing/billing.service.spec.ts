import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PREMIUM_PRODUCT_CODE } from './billing.constants';
import { BillingService } from './billing.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const USER_ID = 'user-1';
const PRODUCT_ID = 'product-1';
const PRICE_BR_ID = 'price-br';
const PRICE_INTL_ID = 'price-intl';

type Row = Record<string, unknown>;

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      return matches(row, value as Row);
    }
    return row[key] === value;
  });
}

function uniqueConflict() {
  return Object.assign(new Error('Unique constraint failed'), {
    code: 'P2002',
  });
}

function createBillingDb() {
  const state = {
    products: [] as Row[],
    prices: [] as Row[],
    orders: [] as Row[],
    payments: [] as Row[],
    licenses: [] as Row[],
    storeEntitlements: [] as Row[],
    receipts: [] as Row[],
  };

  function insert(
    collection: Row[],
    row: Row,
    conflicts: Array<(candidate: Row) => boolean>,
  ) {
    if (conflicts.some((conflict) => stateOf(collection).some(conflict))) {
      throw uniqueConflict();
    }
    const stored = {
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...row,
    };
    collection.push(stored);
    return stored;
  }

  function stateOf(collection: Row[]) {
    return collection;
  }

  const api = {
    billingProduct: {
      findUnique: ({ where }: { where: Row }) =>
        state.products.find((row) => matches(row, where)) ?? null,
    },
    billingPrice: {
      findUnique: ({ where }: { where: Row }) =>
        state.prices.find((row) => matches(row, where)) ?? null,
    },
    billingOrder: {
      create: ({ data }: { data: Row }) =>
        insert(state.orders, data, [(row) => row.id === data.id]),
      findUnique: ({ where }: { where: Row }) =>
        state.orders.find((row) => matches(row, where)) ?? null,
      updateMany: ({ where, data }: { where: Row; data: Row }) => {
        const rows = state.orders.filter((row) => matches(row, where));
        for (const row of rows) {
          Object.assign(row, data, { updatedAt: new Date() });
        }
        return { count: rows.length };
      },
    },
    billingPayment: {
      findUnique: ({ where }: { where: Row }) =>
        state.payments.find((row) => matches(row, where)) ?? null,
      findFirst: ({ where }: { where: Row }) => {
        const rows = state.payments.filter((row) => matches(row, where));
        return rows.at(-1) ?? null;
      },
      create: ({ data }: { data: Row }) =>
        insert(state.payments, data, [
          (row) =>
            data.providerPaymentId != null &&
            row.provider === data.provider &&
            row.providerPaymentId === data.providerPaymentId,
        ]),
      update: ({ where, data }: { where: Row; data: Row }) => {
        const row = state.payments.find((candidate) =>
          matches(candidate, where),
        );
        if (!row) {
          throw new Error('Payment not found');
        }
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
    },
    billingLicense: {
      findFirst: ({ where }: { where: Row }) =>
        state.licenses.find((row) => matches(row, where)) ?? null,
      findUnique: ({ where }: { where: Row }) =>
        state.licenses.find((row) => matches(row, where)) ?? null,
      create: ({ data }: { data: Row }) =>
        insert(state.licenses, { grantedAt: new Date(), ...data }, [
          (row) => row.orderId === data.orderId,
          (row) =>
            data.activeUserProductKey != null &&
            row.activeUserProductKey === data.activeUserProductKey,
        ]),
      updateMany: ({ where, data }: { where: Row; data: Row }) => {
        const rows = state.licenses.filter((row) => matches(row, where));
        for (const row of rows) {
          Object.assign(row, data, { updatedAt: new Date() });
        }
        return { count: rows.length };
      },
    },
    billingStoreEntitlement: {
      findFirst: ({ where }: { where: Row }) =>
        state.storeEntitlements.find((row) => matches(row, where)) ?? null,
      upsert: ({
        where,
        create,
        update,
      }: {
        where: { userId_provider_productId: Row };
        create: Row;
        update: Row;
      }) => {
        const row = state.storeEntitlements.find((candidate) =>
          matches(candidate, where.userId_provider_productId),
        );
        if (row) {
          Object.assign(row, update, { updatedAt: new Date() });
          return row;
        }
        return insert(state.storeEntitlements, create, [
          (candidate) =>
            candidate.userId === create.userId &&
            candidate.provider === create.provider &&
            candidate.productId === create.productId,
        ]);
      },
    },
    billingEventReceipt: {
      findUnique: ({ where }: { where: Row }) =>
        state.receipts.find((row) => matches(row, where)) ?? null,
      create: ({ data }: { data: Row }) =>
        insert(state.receipts, data, [
          (row) =>
            row.provider === data.provider &&
            row.providerEventId === data.providerEventId,
        ]),
    },
    async $transaction<T>(fn: (tx: typeof api) => Promise<T>) {
      const snapshot = structuredClone(state);
      try {
        return await fn(api);
      } catch (error) {
        state.products = snapshot.products;
        state.prices = snapshot.prices;
        state.orders = snapshot.orders;
        state.payments = snapshot.payments;
        state.licenses = snapshot.licenses;
        state.storeEntitlements = snapshot.storeEntitlements;
        state.receipts = snapshot.receipts;
        throw error;
      }
    },
  };

  return {
    state,
    // The in-memory fake is intentionally structural, not a Prisma client.
    api: api as unknown as PrismaService,
  };
}

function seedCatalog(
  state: ReturnType<typeof createBillingDb>['state'],
  prices = {
    br: 4990,
    intl: 1499,
  },
) {
  const now = new Date('2026-10-10T00:00:00.000Z');
  state.products.push({
    id: PRODUCT_ID,
    code: PREMIUM_PRODUCT_CODE,
    name: 'RuneCodex Premium',
    active: true,
    createdAt: now,
    updatedAt: now,
  });
  state.prices.push(
    {
      id: PRICE_BR_ID,
      productId: PRODUCT_ID,
      market: 'BR',
      currency: 'BRL',
      amountMinor: prices.br,
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: PRICE_INTL_ID,
      productId: PRODUCT_ID,
      market: 'INTL',
      currency: 'USD',
      amountMinor: prices.intl,
      active: true,
      createdAt: now,
      updatedAt: now,
    },
  );
}

describe('BillingService', () => {
  let service: BillingService;
  let db: ReturnType<typeof createBillingDb>;

  beforeEach(async () => {
    db = createBillingDb();
    seedCatalog(db.state);
    const moduleRef = await Test.createTestingModule({
      providers: [BillingService, { provide: PrismaService, useValue: db.api }],
    }).compile();
    service = moduleRef.get(BillingService);
  });

  it('snapshots the approved integer price on a pending order', async () => {
    const brazil = await service.createOrder(USER_ID, 'BR');
    const international = await service.createOrder(USER_ID, 'INTL');

    expect(brazil).toMatchObject({
      userId: USER_ID,
      productCode: PREMIUM_PRODUCT_CODE,
      market: 'BR',
      currency: 'BRL',
      amountMinor: 4990,
      status: 'PENDING',
    });
    expect(international).toMatchObject({
      market: 'INTL',
      currency: 'USD',
      amountMinor: 1499,
      status: 'PENDING',
    });
    expect(db.state.orders).toHaveLength(2);
    expect(db.state.payments).toHaveLength(0);
    expect(db.state.licenses).toHaveLength(0);
    expect(Number.isInteger(brazil.amountMinor)).toBe(true);
    expect(Number.isInteger(international.amountMinor)).toBe(true);
  });

  it('rejects a stored price that differs from the approved amount', async () => {
    db.state.prices[0].amountMinor = 5000;

    await expect(service.createOrder(USER_ID, 'BR')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(db.state.orders).toHaveLength(0);
  });

  it('grants one license for an order and ignores a repeated paid event', async () => {
    const order = await service.createOrder(USER_ID, 'BR');
    const paid = {
      provider: 'test',
      providerEventId: 'evt-paid-1',
      providerPaymentId: 'pay-1',
      orderId: order.id,
      type: 'PAYMENT_PAID' as const,
    };

    const first = await service.applyProviderEvent(paid);
    const repeat = await service.applyProviderEvent(paid);
    const anotherEvent = await service.applyProviderEvent({
      ...paid,
      providerEventId: 'evt-paid-2',
    });

    expect(first).toMatchObject({
      duplicate: false,
      orderStatus: 'PAID',
      licenseStatus: 'ACTIVE',
    });
    expect(repeat).toMatchObject({
      duplicate: true,
      orderStatus: 'PAID',
      licenseStatus: 'ACTIVE',
    });
    expect(anotherEvent.duplicate).toBe(false);
    expect(db.state.licenses).toHaveLength(1);
    expect(db.state.licenses[0]).toMatchObject({
      userId: USER_ID,
      orderId: order.id,
      status: 'ACTIVE',
      activeUserProductKey: `${USER_ID}:${PRODUCT_ID}`,
    });
    expect(db.state.receipts).toHaveLength(2);
    expect(db.state.payments).toHaveLength(1);
    expect(db.state.payments[0]).toMatchObject({
      status: 'PAID',
      amountMinor: 4990,
      currency: 'BRL',
    });
  });

  it('does not grant a second active license from another order', async () => {
    const first = await service.createOrder(USER_ID, 'BR');
    const second = await service.createOrder(USER_ID, 'BR');
    await service.applyProviderEvent({
      provider: 'test',
      providerEventId: 'evt-first',
      providerPaymentId: 'pay-first',
      orderId: first.id,
      type: 'PAYMENT_PAID',
    });

    await expect(
      service.applyProviderEvent({
        provider: 'test',
        providerEventId: 'evt-second',
        providerPaymentId: 'pay-second',
        orderId: second.id,
        type: 'PAYMENT_PAID',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(db.state.licenses).toHaveLength(1);
    expect(
      db.state.orders.find((order) => order.id === second.id)?.status,
    ).toBe('PENDING');
    expect(db.state.receipts).toHaveLength(1);
    await expect(service.createOrder(USER_ID, 'BR')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('revokes the license on refund and keeps the order history', async () => {
    const order = await service.createOrder(USER_ID, 'BR');
    await service.applyProviderEvent({
      provider: 'test',
      providerEventId: 'evt-paid',
      providerPaymentId: 'pay-1',
      orderId: order.id,
      type: 'PAYMENT_PAID',
    });

    const refund = await service.applyProviderEvent({
      provider: 'test',
      providerEventId: 'evt-refund',
      providerPaymentId: 'pay-1',
      orderId: order.id,
      type: 'PAYMENT_REFUNDED',
    });
    const repeat = await service.applyProviderEvent({
      provider: 'test',
      providerEventId: 'evt-refund',
      providerPaymentId: 'pay-1',
      orderId: order.id,
      type: 'PAYMENT_REFUNDED',
    });

    expect(refund).toMatchObject({
      duplicate: false,
      orderId: order.id,
      orderStatus: 'REFUNDED',
      licenseStatus: 'REVOKED',
    });
    expect(repeat.duplicate).toBe(true);
    expect(db.state.orders).toEqual([
      expect.objectContaining({
        id: order.id,
        status: 'REFUNDED',
        amountMinor: 4990,
        currency: 'BRL',
      }),
    ]);
    expect(db.state.licenses).toEqual([
      expect.objectContaining({
        orderId: order.id,
        status: 'REVOKED',
        activeUserProductKey: null,
      }),
    ]);
    expect(db.state.payments[0]).toMatchObject({ status: 'REFUNDED' });
    expect(db.state.receipts).toHaveLength(2);

    const repurchase = await service.createOrder(USER_ID, 'BR');
    await service.applyProviderEvent({
      provider: 'test',
      providerEventId: 'evt-paid-again',
      providerPaymentId: 'pay-2',
      orderId: repurchase.id,
      type: 'PAYMENT_PAID',
    });
    expect(db.state.licenses.map((license) => license.status).sort()).toEqual([
      'ACTIVE',
      'REVOKED',
    ]);
    expect(
      db.state.licenses.filter((license) => license.activeUserProductKey)
        .length,
    ).toBe(1);
  });

  it('keeps a failed charge from granting a license', async () => {
    const order = await service.createOrder(USER_ID, 'BR');

    const result = await service.applyProviderEvent({
      provider: 'test',
      providerEventId: 'evt-failed',
      providerPaymentId: 'pay-failed',
      orderId: order.id,
      type: 'PAYMENT_FAILED',
    });

    expect(result).toMatchObject({
      duplicate: false,
      orderStatus: 'PENDING',
      licenseStatus: null,
    });
    expect(db.state.payments).toEqual([
      expect.objectContaining({ status: 'FAILED', amountMinor: 4990 }),
    ]);
    expect(db.state.licenses).toHaveLength(0);
    await expect(
      service.applyProviderEvent({
        provider: 'test',
        providerEventId: 'evt-refund-failed',
        providerPaymentId: 'pay-failed',
        orderId: order.id,
        type: 'PAYMENT_REFUNDED',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.state.orders[0].status).toBe('PENDING');
  });

  it('keeps a pending provider update from granting a license', async () => {
    const order = await service.createOrder(USER_ID, 'BR');
    db.state.payments.push({
      id: 'pay-row',
      orderId: order.id,
      provider: 'test',
      providerPaymentId: null,
      status: 'PENDING',
      currency: 'BRL',
      amountMinor: 4990,
      checkoutUrl: 'https://checkout.example/pay',
      createdAt: new Date(),
      updatedAt: new Date(),
      paidAt: null,
      refundedAt: null,
    });

    const result = await service.applyProviderEvent({
      provider: 'test',
      providerEventId: 'evt-pending',
      providerPaymentId: '9001',
      orderId: order.id,
      type: 'PAYMENT_PENDING',
    });

    expect(result).toMatchObject({
      duplicate: false,
      orderStatus: 'PENDING',
      licenseStatus: null,
    });
    expect(db.state.licenses).toHaveLength(0);
    expect(db.state.payments).toHaveLength(1);
    expect(db.state.payments[0]).toMatchObject({
      providerPaymentId: '9001',
      status: 'PENDING',
    });
  });

  it('grants and revokes Premium from server-synced store entitlements', async () => {
    const active = await service.syncStoreEntitlement(USER_ID, true);
    expect(active).toMatchObject({
      access: true,
      licenseStatus: 'ACTIVE',
      paymentStatus: 'PAID',
    });
    expect(db.state.storeEntitlements).toEqual([
      expect.objectContaining({
        userId: USER_ID,
        productId: PRODUCT_ID,
        provider: 'revenuecat',
        active: true,
      }),
    ]);

    const inactive = await service.syncStoreEntitlement(USER_ID, false);
    expect(inactive.access).toBe(false);
    expect(inactive.paymentStatus).toBe('NONE');
  });

  it('does not reactivate a refunded license when a later approval arrives', async () => {
    const order = await service.createOrder(USER_ID, 'BR');
    await service.applyProviderEvent({
      provider: 'test',
      providerEventId: 'evt-paid',
      providerPaymentId: 'pay-1',
      orderId: order.id,
      type: 'PAYMENT_PAID',
    });
    await service.applyProviderEvent({
      provider: 'test',
      providerEventId: 'evt-refund',
      providerPaymentId: 'pay-1',
      orderId: order.id,
      type: 'PAYMENT_REFUNDED',
    });

    await expect(
      service.applyProviderEvent({
        provider: 'test',
        providerEventId: 'evt-paid-late',
        providerPaymentId: 'pay-1',
        orderId: order.id,
        type: 'PAYMENT_PAID',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.state.licenses).toEqual([
      expect.objectContaining({
        status: 'REVOKED',
        activeUserProductKey: null,
      }),
    ]);
  });

  it('keeps an approved license when an older pending event arrives later', async () => {
    const order = await service.createOrder(USER_ID, 'BR');
    await service.applyProviderEvent({
      provider: 'test',
      providerEventId: 'evt-paid',
      providerPaymentId: 'pay-1',
      orderId: order.id,
      type: 'PAYMENT_PAID',
    });

    const late = await service.applyProviderEvent({
      provider: 'test',
      providerEventId: 'evt-pending-late',
      providerPaymentId: 'pay-1',
      orderId: order.id,
      type: 'PAYMENT_PENDING',
    });

    expect(late).toMatchObject({
      orderStatus: 'PAID',
      licenseStatus: 'ACTIVE',
    });
    expect(db.state.payments[0]).toMatchObject({ status: 'PAID' });
    expect(db.state.licenses).toHaveLength(1);
  });

  it('does not treat an expired license as access', async () => {
    db.state.licenses.push({
      id: 'license-expired',
      userId: USER_ID,
      productId: PRODUCT_ID,
      status: 'ACTIVE',
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
      term: 'FIXED',
      source: 'VOUCHER',
      grantedAt: new Date('2019-01-01T00:00:00.000Z'),
      activeUserProductKey: `${USER_ID}:${PRODUCT_ID}`,
    });

    await expect(service.getPremium(USER_ID)).resolves.toMatchObject({
      access: false,
      licenseStatus: 'EXPIRED',
      channel: null,
    });
  });

  it('denies Premium when the billing schema is missing and keeps other database errors', async () => {
    const missingTable = Object.assign(new Error('table does not exist'), {
      code: 'P2021',
    });
    const prisma = {
      billingProduct: {
        findUnique: jest.fn().mockRejectedValue(missingTable),
      },
      billingLicense: { findFirst: jest.fn() },
      billingStoreEntitlement: { findFirst: jest.fn() },
      billingPayment: { findFirst: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [BillingService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const isolated = moduleRef.get(BillingService);

    await expect(isolated.getPremium(USER_ID)).resolves.toEqual({
      productCode: PREMIUM_PRODUCT_CODE,
      access: false,
      licenseStatus: null,
      paymentStatus: 'NONE',
      term: null,
      source: null,
      expiresAt: null,
      activatedAt: null,
      channel: null,
    });
    expect(prisma.billingLicense.findFirst).not.toHaveBeenCalled();

    prisma.billingProduct.findUnique.mockRejectedValue(
      new Error('connection lost'),
    );
    await expect(isolated.getPremium(USER_ID)).rejects.toThrow(
      'connection lost',
    );
  });
});
