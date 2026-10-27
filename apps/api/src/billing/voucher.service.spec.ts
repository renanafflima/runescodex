import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminAuditService } from '../audit/admin-audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from './billing.service';
import { hashVoucherCode } from './voucher-code';
import { VoucherService } from './voucher.service';

type Row = Record<string, unknown>;

function world() {
  const vouchers: Row[] = [];
  const licenses: Row[] = [];
  const redemptions: Row[] = [];
  const tx = {
    billingVoucher: {
      findUnique: ({ where }: { where: Row }) =>
        vouchers.find(
          (row) => row.codeHash === where.codeHash || row.id === where.id,
        ) ?? null,
      updateMany: ({ where, data }: { where: Row; data: Row }) => {
        const row = vouchers.find((item) => item.id === where.id);
        if (!row || (where.status && row.status !== where.status)) {
          return { count: 0 };
        }
        const limit = where.redeemedCount as { lt?: number } | undefined;
        if (limit?.lt != null && Number(row.redeemedCount) >= limit.lt) {
          return { count: 0 };
        }
        const increment = (
          data.redeemedCount as { increment?: number } | undefined
        )?.increment;
        if (increment) {
          row.redeemedCount = Number(row.redeemedCount) + increment;
        }
        if (data.status) {
          row.status = data.status;
        }
        return { count: 1 };
      },
    },
    billingVoucherRedemption: {
      count: ({ where }: { where: Row }) =>
        redemptions.filter(
          (row) =>
            row.voucherId === where.voucherId &&
            row.userId === where.userId &&
            row.result === where.result,
        ).length,
      create: ({ data }: { data: Row }) => {
        const row = { id: crypto.randomUUID(), ...data };
        redemptions.push(row);
        return row;
      },
    },
    billingLicense: {
      findFirst: ({ where }: { where: Row }) =>
        licenses.find(
          (row) =>
            row.userId === where.userId &&
            row.productId === where.productId &&
            row.status === where.status,
        ) ?? null,
      updateMany: ({ where, data }: { where: Row; data: Row }) => {
        const row = licenses.find(
          (item) => item.id === where.id && item.status === where.status,
        );
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
      create: ({ data }: { data: Row }) => {
        if (
          licenses.some(
            (row) =>
              data.activeUserProductKey &&
              row.activeUserProductKey === data.activeUserProductKey,
          )
        ) {
          throw Object.assign(new Error('unique'), { code: 'P2002' });
        }
        const row = { id: crypto.randomUUID(), ...data };
        licenses.push(row);
        return row;
      },
    },
  };
  return {
    vouchers,
    licenses,
    redemptions,
    prisma: { $transaction: (fn: (client: typeof tx) => unknown) => fn(tx) },
    audits: [] as Row[],
  };
}

function voucher(overrides: Row = {}): Row {
  return {
    id: 'voucher-1',
    codeHash: hashVoucherCode('RC-TEST-CODE-1234'),
    benefit: 'FREE',
    productId: 'product-1',
    term: 'LIFETIME',
    durationDays: null,
    maxRedemptions: 1,
    redeemedCount: 0,
    perUserLimit: 1,
    startsAt: new Date('2020-01-01T00:00:00.000Z'),
    endsAt: null,
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('VoucherService', () => {
  async function serviceFor(state: ReturnType<typeof world>) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        VoucherService,
        { provide: PrismaService, useValue: state.prisma },
        {
          provide: BillingService,
          useValue: {
            getPremium: jest.fn().mockResolvedValue({
              access: true,
              licenseStatus: 'ACTIVE',
            }),
          },
        },
        {
          provide: AdminAuditService,
          useValue: {
            record: (input: Row) => {
              state.audits.push(input);
            },
          },
        },
      ],
    }).compile();
    return moduleRef.get(VoucherService);
  }

  it('redeems a code for the authenticated user and does not keep a second copy', async () => {
    const state = world();
    state.vouchers.push(voucher());
    const service = await serviceFor(state);

    await expect(
      service.redeem('user-1', 'rc-test-code-1234'),
    ).resolves.toMatchObject({
      access: true,
    });

    expect(state.licenses).toHaveLength(1);
    expect(state.licenses[0]).toMatchObject({
      userId: 'user-1',
      source: 'VOUCHER',
    });
    expect(state.licenses[0].orderId).toBeUndefined();
    expect(state.redemptions).toEqual([
      expect.objectContaining({ result: 'SUCCESS', userId: 'user-1' }),
    ]);
    expect(state.audits).toEqual([
      expect.objectContaining({
        action: 'voucher.redeem',
        actorUserId: 'user-1',
      }),
    ]);
    expect(JSON.stringify(state.audits)).not.toContain('RC-TEST-CODE-1234');
  });

  it('rejects an unknown, paused, expired or exhausted code without granting access', async () => {
    const state = world();
    const service = await serviceFor(state);
    await expect(
      service.redeem('user-1', 'RC-NONE-CODE-9999'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(state.redemptions).toHaveLength(0);

    state.vouchers.push(voucher({ status: 'PAUSED' }));
    await expect(
      service.redeem('user-1', 'RC-TEST-CODE-1234'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(state.licenses).toHaveLength(0);
    expect(state.redemptions[0]).toMatchObject({ reason: 'PAUSED' });

    state.vouchers[0].status = 'ACTIVE';
    state.vouchers[0].endsAt = new Date('2020-01-01T00:00:00.000Z');
    await expect(
      service.redeem('user-1', 'RC-TEST-CODE-1234'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(state.redemptions.at(-1)).toMatchObject({ reason: 'EXPIRED' });

    state.vouchers[0].endsAt = null;
    state.vouchers[0].redeemedCount = 1;
    await expect(
      service.redeem('user-1', 'RC-TEST-CODE-1234'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(state.redemptions.at(-1)).toMatchObject({ reason: 'EXHAUSTED' });
  });

  it('enforces the per-user limit without consuming another slot', async () => {
    const state = world();
    state.vouchers.push(voucher({ maxRedemptions: 5, perUserLimit: 1 }));
    state.redemptions.push({
      voucherId: 'voucher-1',
      userId: 'user-1',
      result: 'SUCCESS',
    });
    const service = await serviceFor(state);

    await expect(
      service.redeem('user-1', 'RC-TEST-CODE-1234'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(state.vouchers[0].redeemedCount).toBe(0);
    expect(state.redemptions.at(-1)).toMatchObject({ reason: 'USER_LIMIT' });
  });

  it('lets only one of two concurrent redemptions take the last slot', async () => {
    const state = world();
    state.vouchers.push(voucher({ maxRedemptions: 1 }));
    const service = await serviceFor(state);

    const results = await Promise.allSettled([
      service.redeem('user-1', 'RC-TEST-CODE-1234'),
      service.redeem('user-2', 'RC-TEST-CODE-1234'),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(state.licenses).toHaveLength(1);
    expect(state.vouchers[0].redeemedCount).toBe(1);
  });

  it('does not redeem when the account already has access', async () => {
    const state = world();
    state.vouchers.push(voucher());
    state.licenses.push({
      id: 'license-1',
      userId: 'user-1',
      productId: 'product-1',
      status: 'ACTIVE',
      expiresAt: null,
      activeUserProductKey: 'user-1:product-1',
    });
    const service = await serviceFor(state);

    await expect(
      service.redeem('user-1', 'RC-TEST-CODE-1234'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(state.licenses).toHaveLength(1);
    expect(state.vouchers[0].redeemedCount).toBe(0);
    expect(state.redemptions[0]).toMatchObject({ reason: 'ALREADY_LICENSED' });
  });
});
