/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unnecessary-type-assertion */
import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminAuditService } from '../audit/admin-audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReferralService } from './referral.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('ReferralService', () => {
  const users = new Map<
    string,
    {
      id: string;
      email: string;
      referralCode: string | null;
      activeCharacter: { name: string } | null;
    }
  >();
  const attributions: Array<Record<string, unknown>> = [];
  const rewards: Array<Record<string, unknown>> = [];
  const tickets: Array<Record<string, unknown>> = [];
  const messages: Array<Record<string, unknown>> = [];
  const orders: Array<Record<string, unknown>> = [];
  const licenses: Array<Record<string, unknown>> = [];
  const payments: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];

  function unique() {
    const error = new Error('unique') as Error & { code: string };
    error.code = 'P2002';
    throw error;
  }

  const prisma = {
    user: {
      findUnique: async ({
        where,
      }: {
        where: { id?: string; referralCode?: string };
      }) =>
        [...users.values()].find((user) =>
          where.id
            ? user.id === where.id
            : user.referralCode === where.referralCode,
        ) ?? null,
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; referralCode: null };
        data: { referralCode: string };
      }) => {
        const user = users.get(where.id);
        if (!user || user.referralCode) return { count: 0 };
        if (
          [...users.values()].some(
            (item) => item.referralCode === data.referralCode,
          )
        )
          unique();
        user.referralCode = data.referralCode;
        return { count: 1 };
      },
      count: async () =>
        [...users.values()].filter((user) => user.referralCode).length,
    },
    referralAttribution: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (
          attributions.some((row) => row.referredUserId === data.referredUserId)
        )
          unique();
        const row = {
          id: `attr-${attributions.length + 1}`,
          stage: 'WAITING_PURCHASE',
          createdAt: new Date(),
          ...data,
        };
        attributions.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { referredUserId: string } }) => {
        const row = attributions.find(
          (item) => item.referredUserId === where.referredUserId,
        );
        if (!row) return null;
        return {
          ...row,
          reward:
            rewards.find((reward) => reward.attributionId === row.id) ?? null,
          referrer: users.get(String(row.referrerUserId)),
          referred: users.get(String(row.referredUserId)),
        };
      },
      findMany: async () => [],
      count: async ({
        where,
      }: {
        where: { referrerUserId?: string; stage?: string };
      }) =>
        attributions.filter(
          (row) =>
            (where.referrerUserId
              ? row.referrerUserId === where.referrerUserId
              : true) && (where.stage ? row.stage === where.stage : true),
        ).length,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = attributions.find((item) => item.id === where.id);
        Object.assign(row ?? {}, data);
        return row;
      },
    },
    referralReward: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (
          rewards.some(
            (row) =>
              row.attributionId === data.attributionId ||
              row.orderId === data.orderId,
          )
        )
          unique();
        const row = {
          id: `reward-${rewards.length + 1}`,
          status: 'PENDING_DELIVERY',
          ticketId: null,
          tibiaCoins: 100,
          reviewRequired: false,
          releasedAt: new Date(),
          deliveredAt: null,
          createdAt: new Date(),
          ...data,
        };
        rewards.push(row);
        return row;
      },
      findUnique: async ({
        where,
      }: {
        where: { attributionId?: string; orderId?: string; id?: string };
      }) =>
        rewards.find((row) =>
          where.attributionId
            ? row.attributionId === where.attributionId
            : where.orderId
              ? row.orderId === where.orderId
              : row.id === where.id,
        ) ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = rewards.find((item) => item.id === where.id);
        Object.assign(row ?? {}, data);
        return row;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; status?: string; ticketId?: null };
        data: Record<string, unknown>;
      }) => {
        const row = rewards.find(
          (item) =>
            item.id === where.id &&
            (where.status === undefined || item.status === where.status) &&
            (where.ticketId === undefined || item.ticketId === where.ticketId),
        );
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
      groupBy: async () => [],
    },
    billingOrder: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const order = orders.find((item) => item.id === where.id);
        if (!order) return null;
        return {
          ...order,
          license: licenses.find((item) => item.orderId === order.id) ?? null,
          payments: payments.filter((item) => item.orderId === order.id),
        };
      },
    },
    ticket: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `ticket-${tickets.length + 1}`, ...data };
        tickets.push(row);
        return row;
      },
      update: async () => ({}),
      delete: async ({ where }: { where: { id: string } }) => {
        const index = tickets.findIndex((item) => item.id === where.id);
        if (index >= 0) tickets.splice(index, 1);
        return { id: where.id };
      },
    },
    ticketMessage: {
      create: async ({ data }: { data: Record<string, unknown> }) =>
        messages.push(data),
    },
    $transaction: async (fn: (tx: typeof prisma) => Promise<unknown>) =>
      fn(prisma),
  };

  let service: ReferralService;

  beforeEach(async () => {
    users.clear();
    attributions.length = 0;
    rewards.length = 0;
    tickets.length = 0;
    messages.length = 0;
    orders.length = 0;
    licenses.length = 0;
    payments.length = 0;
    audits.length = 0;
    users.set('referrer', {
      id: 'referrer',
      email: 'a@example.com',
      referralCode: null,
      activeCharacter: { name: 'Ada' },
    });
    users.set('friend', {
      id: 'friend',
      email: 'b@example.com',
      referralCode: null,
      activeCharacter: { name: 'Bia' },
    });
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReferralService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: AdminAuditService,
          useValue: {
            record: (input: Record<string, unknown>) => audits.push(input),
          },
        },
      ],
    }).compile();
    service = moduleRef.get(ReferralService);
  });

  it('keeps one stable code and rejects self or duplicate attribution', async () => {
    const first = await service.ensureCode('referrer');
    expect(await service.ensureCode('referrer')).toBe(first);
    await expect(service.attribute('friend', 'nope')).resolves.toEqual({
      attributed: false,
    });
    await expect(service.attribute('referrer', first)).resolves.toEqual({
      attributed: false,
    });
    await expect(service.attribute('friend', first)).resolves.toEqual({
      attributed: true,
    });
    await expect(service.attribute('friend', first)).resolves.toEqual({
      attributed: false,
    });
    expect(attributions).toHaveLength(1);
    expect(audits.some((item) => item.action === 'referral.self')).toBe(true);
    expect(audits.some((item) => item.action === 'referral.assigned')).toBe(
      true,
    );
  });

  it('creates one reward and one ticket for a confirmed purchase, and not for pending or a repeat', async () => {
    const code = await service.ensureCode('referrer');
    await service.attribute('friend', code);
    orders.push({ id: 'order-1', userId: 'friend', status: 'PENDING' });
    await expect(service.settlePaidOrder('order-1')).resolves.toEqual({
      created: false,
    });
    orders[0]!.status = 'PAID';
    licenses.push({
      id: 'license-1',
      orderId: 'order-1',
      source: 'PURCHASE',
      status: 'ACTIVE',
      expiresAt: null,
    });
    payments.push({ id: 'payment-1', orderId: 'order-1', status: 'FAILED' });
    await expect(service.settlePaidOrder('order-1')).resolves.toEqual({
      created: false,
    });
    payments[0]!.status = 'PAID';
    const created = await service.settlePaidOrder('order-1');
    expect(created).toMatchObject({ created: true });
    expect(rewards).toHaveLength(1);
    expect(rewards[0]?.tibiaCoins).toBe(100);
    expect(tickets).toHaveLength(1);
    expect(String(tickets[0]?.description)).toContain('100 TC');
    expect(JSON.stringify(messages)).not.toMatch(/password|token|card/i);
    expect(JSON.stringify(tickets)).not.toMatch(/password|token/);
    await expect(service.settlePaidOrder('order-1')).resolves.toMatchObject({
      created: false,
    });
    expect(rewards).toHaveLength(1);
    expect(tickets).toHaveLength(1);
  });

  it('blocks delivery after a refund and records a manual delivery once', async () => {
    const code = await service.ensureCode('referrer');
    await service.attribute('friend', code);
    orders.push({ id: 'order-1', userId: 'friend', status: 'PAID' });
    licenses.push({
      id: 'license-1',
      orderId: 'order-1',
      source: 'PURCHASE',
      status: 'ACTIVE',
      expiresAt: null,
    });
    payments.push({ id: 'payment-1', orderId: 'order-1', status: 'PAID' });
    const created = await service.settlePaidOrder('order-1');
    if (!created || !('rewardId' in created) || !created.rewardId)
      throw new Error('missing reward');
    payments[0]!.status = 'REFUNDED';
    orders[0]!.status = 'REFUNDED';
    await service.holdAfterRefund('order-1');
    await expect(
      service.deliver('admin', String(created.rewardId)),
    ).rejects.toBeInstanceOf(ConflictException);
    payments[0]!.status = 'PAID';
    orders[0]!.status = 'PAID';
    await service.release(
      'admin',
      String(created.rewardId),
      'Pagamento voltou a ficar elegível',
    );
    await expect(
      service.deliver('admin', String(created.rewardId)),
    ).resolves.toEqual({ delivered: true });
    await expect(
      service.deliver('admin', String(created.rewardId)),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(rewards[0]?.deliveredByUserId).toBe('admin');
    expect(audits.some((item) => item.action === 'referral.delivered')).toBe(
      true,
    );
  });
});
