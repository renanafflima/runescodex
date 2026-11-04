import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { BillingCheckoutAttemptService } from './billing-checkout-attempt.service';
import { checkoutAttemptIdempotencyKey } from './billing-checkout-attempt.sanitize';
import { checkoutLockUserKey } from './billing-checkout-lock';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

type AttemptRow = {
  id: string;
  userId: string;
  orderId: string;
  generation: number;
  state: 'CREATING' | 'READY' | 'FAILED' | 'UNKNOWN';
  idempotencyKey: string;
  leaseOwner: string | null;
  leaseExpiresAt: Date | null;
  providerCheckoutId: string | null;
  billingPaymentId: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

function uniqueConflict() {
  return Object.assign(new Error('Unique constraint failed'), {
    code: 'P2002',
  });
}

function matches(
  row: Record<string, unknown>,
  where: Record<string, unknown>,
): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (
      value &&
      typeof value === 'object' &&
      !(value instanceof Date) &&
      !Array.isArray(value)
    ) {
      if ('in' in (value as { in?: unknown })) {
        return ((value as { in: unknown[] }).in ?? []).includes(row[key]);
      }
      if ('lte' in (value as { lte?: Date })) {
        const left = row[key];
        const right = (value as { lte: Date }).lte;
        return left instanceof Date && left.getTime() <= right.getTime();
      }
      return matches(row, value as Record<string, unknown>);
    }
    return row[key] === value;
  });
}

function createStore() {
  const orders: Array<{ id: string; userId: string }> = [];
  const attempts: AttemptRow[] = [];
  const lockTail = new Map<string, Promise<void>>();
  let throwP2002OnCreate = false;

  function assertUniques(candidate: AttemptRow) {
    if (
      attempts.some((row) => row.idempotencyKey === candidate.idempotencyKey)
    ) {
      throw uniqueConflict();
    }
    if (
      candidate.billingPaymentId &&
      attempts.some(
        (row) => row.billingPaymentId === candidate.billingPaymentId,
      )
    ) {
      throw uniqueConflict();
    }
    if (
      attempts.some(
        (row) =>
          row.orderId === candidate.orderId &&
          row.generation === candidate.generation,
      )
    ) {
      throw uniqueConflict();
    }
    if (
      (candidate.state === 'CREATING' || candidate.state === 'UNKNOWN') &&
      attempts.some(
        (row) =>
          row.userId === candidate.userId &&
          (row.state === 'CREATING' || row.state === 'UNKNOWN'),
      )
    ) {
      throw uniqueConflict();
    }
  }

  const model = {
    findUnique: async ({
      where,
    }: {
      where: {
        id?: string;
        orderId_generation?: { orderId: string; generation: number };
      };
    }) => {
      if (where.id) {
        return attempts.find((row) => row.id === where.id) ?? null;
      }
      if (where.orderId_generation) {
        return (
          attempts.find(
            (row) =>
              row.orderId === where.orderId_generation?.orderId &&
              row.generation === where.orderId_generation.generation,
          ) ?? null
        );
      }
      return null;
    },
    findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
      const row = attempts.find((candidate) => candidate.id === where.id);
      if (!row) {
        throw new Error('not found');
      }
      return row;
    },
    findMany: async ({
      where,
      orderBy,
    }: {
      where: Record<string, unknown>;
      orderBy?: { generation?: 'asc' | 'desc' };
    }) => {
      const rows = attempts.filter((row) =>
        matches(row as unknown as Record<string, unknown>, where),
      );
      if (orderBy?.generation === 'asc') {
        rows.sort((left, right) => left.generation - right.generation);
      }
      if (orderBy?.generation === 'desc') {
        rows.sort((left, right) => right.generation - left.generation);
      }
      return rows;
    },
    findFirst: async ({
      where,
      orderBy,
    }: {
      where: Record<string, unknown>;
      orderBy?: { createdAt?: 'desc'; generation?: 'desc' };
    }) => {
      const rows = attempts.filter((row) =>
        matches(row as unknown as Record<string, unknown>, where),
      );
      if (orderBy?.generation === 'desc') {
        rows.sort((left, right) => right.generation - left.generation);
      }
      if (orderBy?.createdAt === 'desc') {
        rows.sort(
          (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
        );
      }
      return rows[0] ?? null;
    },
    create: async ({
      data,
    }: {
      data: Omit<AttemptRow, 'id' | 'createdAt' | 'updatedAt'>;
    }) => {
      if (throwP2002OnCreate) {
        throwP2002OnCreate = false;
        attempts.push({
          id: 'winner',
          providerCheckoutId: null,
          billingPaymentId: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
          leaseOwner: 'winner-worker',
        });
        throw uniqueConflict();
      }
      const stored: AttemptRow = {
        id: crypto.randomUUID(),
        providerCheckoutId: null,
        billingPaymentId: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      assertUniques(stored);
      attempts.push(stored);
      return stored;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<AttemptRow>;
    }) => {
      const row = attempts.find((candidate) => candidate.id === where.id);
      if (!row) {
        throw new Error('not found');
      }
      Object.assign(row, data, { updatedAt: new Date() });
      return row;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: Partial<AttemptRow>;
    }) => {
      const rows = attempts.filter((row) =>
        matches(row as unknown as Record<string, unknown>, where),
      );
      for (const row of rows) {
        Object.assign(row, data, { updatedAt: new Date() });
      }
      return { count: rows.length };
    },
  };

  const prisma = {
    billingOrder: {
      findUnique: async ({
        where,
        select,
      }: {
        where: { id: string };
        select?: { id: true; userId: true };
      }) => {
        void select;
        return orders.find((row) => row.id === where.id) ?? null;
      },
    },
    billingCheckoutAttempt: model,
    $executeRaw: async (...args: unknown[]) => {
      void args;
      return 1;
    },
    async $transaction<T>(fn: (tx: typeof prisma) => Promise<T>): Promise<T> {
      const txId = {};
      let release: (() => void) | undefined;
      const tx = {
        ...prisma,
        $executeRaw: async (
          _strings: TemplateStringsArray,
          namespace: unknown,
          userKey: unknown,
        ) => {
          const key = `${String(namespace)}:${String(userKey)}`;
          const previous = lockTail.get(key) ?? Promise.resolve();
          const held = new Promise<void>((resolve) => {
            release = resolve;
          });
          lockTail.set(
            key,
            previous.then(() => held),
          );
          await previous;
          return 1;
        },
      };
      try {
        return await fn(tx);
      } finally {
        release?.();
        void txId;
      }
    },
  };

  return {
    orders,
    attempts,
    prisma,
    seedOrder(id: string, userId: string) {
      orders.push({ id, userId });
    },
    forceNextCreateConflict() {
      throwP2002OnCreate = true;
    },
  };
}

describe('BillingCheckoutAttemptService', () => {
  const now = new Date('2026-11-03T12:00:00.000Z');
  let store: ReturnType<typeof createStore>;
  let service: BillingCheckoutAttemptService;

  beforeEach(async () => {
    store = createStore();
    store.seedOrder('order-1', 'user-1');
    store.seedOrder('order-2', 'user-2');
    const moduleRef = await Test.createTestingModule({
      providers: [
        BillingCheckoutAttemptService,
        { provide: PrismaService, useValue: store.prisma },
      ],
    }).compile();
    service = moduleRef.get(BillingCheckoutAttemptService);
  });

  it('acquires the first CREATING reservation with a stable idempotency key', async () => {
    const result = await service.acquire({
      userId: 'user-1',
      orderId: 'order-1',
      leaseOwner: 'worker-a',
      now,
    });
    expect(result.outcome).toBe('acquired');
    expect(result.attempt).toMatchObject({
      generation: 1,
      state: 'CREATING',
      idempotencyKey: checkoutAttemptIdempotencyKey('order-1', 1),
      leaseOwner: 'worker-a',
    });
  });

  it('serializes two overlapping acquires for the same user', async () => {
    const first = service.acquire({
      userId: 'user-1',
      orderId: 'order-1',
      leaseOwner: 'worker-a',
      now,
    });
    const second = service.acquire({
      userId: 'user-1',
      orderId: 'order-1',
      leaseOwner: 'worker-b',
      now,
    });
    const results = await Promise.all([first, second]);
    expect(results.map((row) => row.outcome).sort()).toEqual([
      'acquired',
      'in_progress',
    ]);
    expect(store.attempts).toHaveLength(1);
    expect(new Set(results.map((row) => row.attempt.idempotencyKey)).size).toBe(
      1,
    );
  });

  it('serializes simulated separate instances that share the database', async () => {
    const other = new BillingCheckoutAttemptService(store.prisma as never);
    const results = await Promise.all([
      service.acquire({
        userId: 'user-1',
        orderId: 'order-1',
        leaseOwner: 'instance-a',
        now,
      }),
      other.acquire({
        userId: 'user-1',
        orderId: 'order-1',
        leaseOwner: 'instance-b',
        now,
      }),
    ]);
    expect(results.filter((row) => row.outcome === 'acquired')).toHaveLength(1);
    expect(results.filter((row) => row.outcome === 'in_progress')).toHaveLength(
      1,
    );
    expect(store.attempts).toHaveLength(1);
  });

  it('returns in_progress while a CREATING lease is still valid', async () => {
    const first = await service.acquire({
      userId: 'user-1',
      orderId: 'order-1',
      leaseOwner: 'worker-a',
      now,
    });
    const retry = await service.acquire({
      userId: 'user-1',
      orderId: 'order-1',
      leaseOwner: 'worker-a',
      now: new Date(now.getTime() + 1_000),
    });
    expect(first.outcome).toBe('acquired');
    expect(retry).toMatchObject({
      outcome: 'in_progress',
      attempt: {
        id: first.attempt.id,
        idempotencyKey: first.attempt.idempotencyKey,
      },
    });
  });

  it('moves an expired CREATING lease to UNKNOWN instead of opening a new attempt', async () => {
    const first = await service.acquire({
      userId: 'user-1',
      orderId: 'order-1',
      leaseOwner: 'worker-a',
      now,
      leaseMs: 1_000,
    });
    const later = await service.acquire({
      userId: 'user-1',
      orderId: 'order-1',
      leaseOwner: 'worker-b',
      now: new Date(now.getTime() + 5_000),
    });
    expect(first.outcome).toBe('acquired');
    expect(later.outcome).toBe('reconciliation_required');
    expect(later.attempt.state).toBe('UNKNOWN');
    expect(store.attempts).toHaveLength(1);
  });

  it('blocks a new reservation while UNKNOWN is unresolved', async () => {
    const first = await service.acquire({
      userId: 'user-1',
      orderId: 'order-1',
      leaseOwner: 'worker-a',
      now,
    });
    await service.markUnknown({
      id: first.attempt.id,
      leaseOwner: 'worker-a',
      now,
      errorCode: 'timeout',
    });
    const blocked = await service.acquire({
      userId: 'user-1',
      orderId: 'order-1',
      leaseOwner: 'worker-b',
      now,
    });
    expect(blocked.outcome).toBe('reconciliation_required');
    expect(store.attempts).toHaveLength(1);
  });

  it('allows a new generation after READY', async () => {
    const first = await service.acquire({
      userId: 'user-1',
      orderId: 'order-1',
      leaseOwner: 'worker-a',
      now,
    });
    await service.markReady({
      id: first.attempt.id,
      leaseOwner: 'worker-a',
      providerCheckoutId: 'pref-1',
      billingPaymentId: 'pay-1',
      now,
    });
    const next = await service.acquire({
      userId: 'user-1',
      orderId: 'order-1',
      leaseOwner: 'worker-b',
      now,
    });
    expect(next.outcome).toBe('acquired');
    expect(next.attempt.generation).toBe(2);
    expect(next.attempt.idempotencyKey).toBe(
      checkoutAttemptIdempotencyKey('order-1', 2),
    );
    expect(store.attempts).toHaveLength(2);
  });

  it('allows a new generation after FAILED', async () => {
    const first = await service.acquire({
      userId: 'user-1',
      orderId: 'order-1',
      leaseOwner: 'worker-a',
      now,
    });
    await service.markFailed({
      id: first.attempt.id,
      leaseOwner: 'worker-a',
      errorCode: 'provider_error',
      now,
    });
    const next = await service.acquire({
      userId: 'user-1',
      orderId: 'order-1',
      leaseOwner: 'worker-b',
      now,
    });
    expect(next.attempt.generation).toBe(2);
    expect(store.attempts.map((row) => row.state).sort()).toEqual([
      'CREATING',
      'FAILED',
    ]);
  });

  it('resolves a P2002 conflict to the winning reservation', async () => {
    store.forceNextCreateConflict();
    const result = await service.acquire({
      userId: 'user-1',
      orderId: 'order-1',
      leaseOwner: 'loser-worker',
      now,
    });
    expect(result).toMatchObject({
      outcome: 'in_progress',
      attempt: { id: 'winner', leaseOwner: 'winner-worker' },
    });
  });

  it('rejects a stale worker that no longer owns the lease', async () => {
    const first = await service.acquire({
      userId: 'user-1',
      orderId: 'order-1',
      leaseOwner: 'worker-a',
      now,
    });
    await expect(
      service.markReady({
        id: first.attempt.id,
        leaseOwner: 'stale-worker',
        providerCheckoutId: 'pref-1',
        billingPaymentId: 'pay-1',
        now,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(store.attempts[0].state).toBe('CREATING');
  });

  it('renews a valid lease and refuses an expired one', async () => {
    const first = await service.acquire({
      userId: 'user-1',
      orderId: 'order-1',
      leaseOwner: 'worker-a',
      now,
      leaseMs: 10_000,
    });
    const renewed = await service.renewLease({
      id: first.attempt.id,
      leaseOwner: 'worker-a',
      now: new Date(now.getTime() + 1_000),
      leaseMs: 20_000,
    });
    expect(renewed.leaseExpiresAt?.getTime()).toBe(now.getTime() + 21_000);
    await expect(
      service.renewLease({
        id: first.attempt.id,
        leaseOwner: 'worker-a',
        now: new Date(now.getTime() + 30_000),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid state transitions', async () => {
    const first = await service.acquire({
      userId: 'user-1',
      orderId: 'order-1',
      leaseOwner: 'worker-a',
      now,
    });
    await service.markReady({
      id: first.attempt.id,
      leaseOwner: 'worker-a',
      providerCheckoutId: 'pref-1',
      billingPaymentId: 'pay-1',
      now,
    });
    await expect(
      service.markFailed({
        id: first.attempt.id,
        leaseOwner: 'worker-a',
        now,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.reconcileUnknown({
        id: first.attempt.id,
        outcome: 'FAILED',
        now,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('keeps the same idempotency key across in_progress retries', async () => {
    const first = await service.acquire({
      userId: 'user-1',
      orderId: 'order-1',
      leaseOwner: 'worker-a',
      now,
    });
    const retry = await service.acquire({
      userId: 'user-1',
      orderId: 'order-1',
      leaseOwner: 'worker-a',
      now,
    });
    expect(retry.attempt.idempotencyKey).toBe(first.attempt.idempotencyKey);
  });

  it('isolates reservations of different users even with the same lock key', async () => {
    expect(checkoutLockUserKey('user-1')).not.toBeUndefined();
    const left = await service.acquire({
      userId: 'user-1',
      orderId: 'order-1',
      leaseOwner: 'worker-a',
      now,
    });
    const right = await service.acquire({
      userId: 'user-2',
      orderId: 'order-2',
      leaseOwner: 'worker-b',
      now,
    });
    expect(left.outcome).toBe('acquired');
    expect(right.outcome).toBe('acquired');
    expect(store.attempts).toHaveLength(2);
    expect(left.attempt.userId).toBe('user-1');
    expect(right.attempt.userId).toBe('user-2');
  });

  it('does not look up a missing attempt', async () => {
    await expect(service.getById('missing')).resolves.toBeNull();
    await expect(
      service.markReady({
        id: 'missing',
        leaseOwner: 'worker-a',
        providerCheckoutId: 'pref-1',
        billingPaymentId: 'pay-1',
        now,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marks READY only after persistPayment succeeds in the same transaction', async () => {
    const first = await service.acquire({
      userId: 'user-1',
      orderId: 'order-1',
      leaseOwner: 'worker-a',
      now,
    });
    const ready = await service.completeReady(
      {
        id: first.attempt.id,
        leaseOwner: 'worker-a',
        providerCheckoutId: 'pref-1',
        expectedUserId: 'user-1',
        expectedOrderId: 'order-1',
        now,
      },
      () => Promise.resolve({ paymentId: 'pay-1', result: { ok: true } }),
    );
    expect(ready).toEqual({ ok: true });
    expect(store.attempts[0]).toMatchObject({
      state: 'READY',
      providerCheckoutId: 'pref-1',
      billingPaymentId: 'pay-1',
    });
  });

  it('does not mark READY when local payment persist fails', async () => {
    const first = await service.acquire({
      userId: 'user-1',
      orderId: 'order-1',
      leaseOwner: 'worker-a',
      now,
    });
    await expect(
      service.completeReady(
        {
          id: first.attempt.id,
          leaseOwner: 'worker-a',
          providerCheckoutId: 'pref-1',
          expectedUserId: 'user-1',
          expectedOrderId: 'order-1',
          now,
        },
        () => Promise.reject(new Error('payment insert failed')),
      ),
    ).rejects.toThrow('payment insert failed');
    expect(store.attempts[0].state).toBe('CREATING');
    expect(store.attempts[0].billingPaymentId).toBeNull();
  });

  it('reconciles UNKNOWN to READY or FAILED without opening a new attempt', async () => {
    const first = await service.acquire({
      userId: 'user-1',
      orderId: 'order-1',
      leaseOwner: 'worker-a',
      now,
    });
    await service.markUnknown({
      id: first.attempt.id,
      leaseOwner: 'worker-a',
      errorCode: 'timeout',
      now,
    });
    const ready = await service.reconcileUnknown({
      id: first.attempt.id,
      outcome: 'READY',
      providerCheckoutId: 'pref-1',
      billingPaymentId: 'pay-1',
      now,
    });
    expect(ready.state).toBe('READY');
    expect(store.attempts).toHaveLength(1);
  });
});

/**
 * Real PostgreSQL proof of concurrent pg_advisory_xact_lock, partial unique
 * index and P2002 races requires a shared Neon/Postgres test database. These
 * Jest tests simulate lock serialization and unique conflicts in-process and
 * are not a substitute for that integration check.
 */
