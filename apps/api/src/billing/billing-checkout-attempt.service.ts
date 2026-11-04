import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import {
  checkoutAttemptIdempotencyKey,
  sanitizeCheckoutAttemptError,
} from './billing-checkout-attempt.sanitize';
import { acquireCheckoutUserLock } from './billing-checkout-lock';

type BillingTx = Prisma.TransactionClient;
type AttemptState = 'CREATING' | 'READY' | 'FAILED' | 'UNKNOWN';

export const CHECKOUT_ATTEMPT_LEASE_MS = 60_000;
export const ACTIVE_CHECKOUT_ATTEMPT_STATES = ['CREATING', 'UNKNOWN'] as const;

export type CheckoutAttemptView = {
  id: string;
  userId: string;
  orderId: string;
  generation: number;
  state: AttemptState;
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

export type AcquireCheckoutAttemptResult =
  | { outcome: 'acquired'; attempt: CheckoutAttemptView }
  | { outcome: 'in_progress'; attempt: CheckoutAttemptView }
  | { outcome: 'reconciliation_required'; attempt: CheckoutAttemptView };

function isUniqueConflict(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

function isLeaseValid(
  attempt: { leaseOwner: string | null; leaseExpiresAt: Date | null },
  now: Date,
  leaseOwner?: string,
) {
  if (!attempt.leaseOwner || !attempt.leaseExpiresAt) {
    return false;
  }
  if (leaseOwner && attempt.leaseOwner !== leaseOwner) {
    return false;
  }
  return attempt.leaseExpiresAt.getTime() > now.getTime();
}

function toView(row: {
  id: string;
  userId: string;
  orderId: string;
  generation: number;
  state: AttemptState;
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
}): CheckoutAttemptView {
  return {
    id: row.id,
    userId: row.userId,
    orderId: row.orderId,
    generation: row.generation,
    state: row.state,
    idempotencyKey: row.idempotencyKey,
    leaseOwner: row.leaseOwner,
    leaseExpiresAt: row.leaseExpiresAt,
    providerCheckoutId: row.providerCheckoutId,
    billingPaymentId: row.billingPaymentId,
    lastErrorCode: row.lastErrorCode,
    lastErrorMessage: row.lastErrorMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
  };
}

@Injectable()
export class BillingCheckoutAttemptService {
  constructor(private readonly prisma: PrismaService) {}

  async acquire(input: {
    userId: string;
    orderId: string;
    leaseOwner: string;
    now?: Date;
    leaseMs?: number;
  }): Promise<AcquireCheckoutAttemptResult> {
    return this.prisma.$transaction((tx) => this.acquireInTx(tx, input));
  }

  async getById(id: string): Promise<CheckoutAttemptView | null> {
    const row = await this.prisma.billingCheckoutAttempt.findUnique({
      where: { id },
    });
    return row ? toView(row) : null;
  }

  async renewLease(input: {
    id: string;
    leaseOwner: string;
    now?: Date;
    leaseMs?: number;
  }): Promise<CheckoutAttemptView> {
    return this.withUserLock(
      input.id,
      async (tx, current, now) => {
        if (current.state !== 'CREATING') {
          throw new ConflictException('Checkout attempt cannot renew lease');
        }
        if (!isLeaseValid(current, now, input.leaseOwner)) {
          throw new ConflictException(
            'Checkout attempt lease cannot be renewed',
          );
        }
        const leaseMs = input.leaseMs ?? CHECKOUT_ATTEMPT_LEASE_MS;
        return this.updateAttempt(tx, current.id, {
          leaseExpiresAt: new Date(now.getTime() + leaseMs),
        });
      },
      input.now,
    );
  }

  async markReady(input: {
    id: string;
    leaseOwner: string;
    providerCheckoutId: string;
    billingPaymentId: string;
    now?: Date;
  }): Promise<CheckoutAttemptView> {
    return this.withUserLock(
      input.id,
      async (tx, current, now) => {
        this.assertMutableByOwner(current, input.leaseOwner, now, ['CREATING']);
        return this.updateAttempt(tx, current.id, {
          state: 'READY',
          providerCheckoutId: input.providerCheckoutId,
          billingPaymentId: input.billingPaymentId,
          leaseOwner: null,
          leaseExpiresAt: null,
          completedAt: now,
        });
      },
      input.now,
    );
  }

  /**
   * Persists BillingPayment and marks the reservation READY in the same
   * PostgreSQL transaction. The persist callback must use the provided tx
   * and must not call Mercado Pago.
   */
  async completeReady<T>(
    input: {
      id: string;
      leaseOwner: string;
      providerCheckoutId: string;
      expectedUserId: string;
      expectedOrderId: string;
      now?: Date;
    },
    persistPayment: (
      tx: BillingTx,
      attempt: CheckoutAttemptView,
    ) => Promise<{ paymentId: string; result: T }>,
  ): Promise<T> {
    return this.withUserLock(
      input.id,
      async (tx, current, now) => {
        this.assertMutableByOwner(current, input.leaseOwner, now, ['CREATING']);
        if (
          current.userId !== input.expectedUserId ||
          current.orderId !== input.expectedOrderId
        ) {
          throw new ConflictException('Checkout attempt does not match order');
        }
        const persisted = await persistPayment(tx, current);
        if (!persisted.paymentId) {
          throw new ConflictException(
            'READY checkout attempt requires a BillingPayment',
          );
        }
        await this.updateAttempt(tx, current.id, {
          state: 'READY',
          providerCheckoutId: input.providerCheckoutId,
          billingPaymentId: persisted.paymentId,
          leaseOwner: null,
          leaseExpiresAt: null,
          completedAt: now,
        });
        return persisted.result;
      },
      input.now,
    );
  }

  async listByOrder(orderId: string): Promise<CheckoutAttemptView[]> {
    const rows = await this.prisma.billingCheckoutAttempt.findMany({
      where: { orderId },
      orderBy: { generation: 'asc' },
    });
    return rows.map(toView);
  }

  async markFailed(input: {
    id: string;
    leaseOwner: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    now?: Date;
  }): Promise<CheckoutAttemptView> {
    return this.withUserLock(
      input.id,
      async (tx, current, now) => {
        this.assertMutableByOwner(current, input.leaseOwner, now, ['CREATING']);
        const error = sanitizeCheckoutAttemptError({
          code: input.errorCode,
          message: input.errorMessage,
        });
        return this.updateAttempt(tx, current.id, {
          state: 'FAILED',
          lastErrorCode: error.lastErrorCode,
          lastErrorMessage: error.lastErrorMessage,
          leaseOwner: null,
          leaseExpiresAt: null,
          completedAt: now,
        });
      },
      input.now,
    );
  }

  async markUnknown(input: {
    id: string;
    leaseOwner: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    now?: Date;
  }): Promise<CheckoutAttemptView> {
    return this.withUserLock(
      input.id,
      async (tx, current, now) => {
        if (current.state !== 'CREATING') {
          throw new ConflictException('Checkout attempt cannot become UNKNOWN');
        }
        if (current.leaseOwner !== input.leaseOwner) {
          throw new ConflictException(
            'Checkout attempt lease owner does not match',
          );
        }
        const error = sanitizeCheckoutAttemptError({
          code: input.errorCode,
          message: input.errorMessage,
        });
        return this.updateAttempt(tx, current.id, {
          state: 'UNKNOWN',
          lastErrorCode: error.lastErrorCode,
          lastErrorMessage: error.lastErrorMessage,
          completedAt: now,
        });
      },
      input.now,
    );
  }

  async reconcileUnknown(input: {
    id: string;
    outcome: 'READY' | 'FAILED';
    providerCheckoutId?: string | null;
    billingPaymentId?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    now?: Date;
  }): Promise<CheckoutAttemptView> {
    return this.withUserLock(
      input.id,
      async (tx, current, now) => {
        if (current.state !== 'UNKNOWN') {
          throw new ConflictException(
            'Checkout attempt reconciliation requires UNKNOWN',
          );
        }
        if (input.outcome === 'READY') {
          if (!input.providerCheckoutId || !input.billingPaymentId) {
            throw new ConflictException(
              'Reconciled READY attempt requires preference and payment ids',
            );
          }
          return this.updateAttempt(tx, current.id, {
            state: 'READY',
            providerCheckoutId: input.providerCheckoutId,
            billingPaymentId: input.billingPaymentId,
            leaseOwner: null,
            leaseExpiresAt: null,
            completedAt: now,
          });
        }
        const error = sanitizeCheckoutAttemptError({
          code: input.errorCode,
          message: input.errorMessage,
        });
        return this.updateAttempt(tx, current.id, {
          state: 'FAILED',
          lastErrorCode: error.lastErrorCode,
          lastErrorMessage: error.lastErrorMessage,
          leaseOwner: null,
          leaseExpiresAt: null,
          completedAt: now,
        });
      },
      input.now,
    );
  }

  private async acquireInTx(
    tx: BillingTx,
    input: {
      userId: string;
      orderId: string;
      leaseOwner: string;
      now?: Date;
      leaseMs?: number;
    },
  ): Promise<AcquireCheckoutAttemptResult> {
    await acquireCheckoutUserLock(tx, input.userId);
    const now = input.now ?? new Date();
    const order = await tx.billingOrder.findUnique({
      where: { id: input.orderId },
      select: { id: true, userId: true },
    });
    if (!order || order.userId !== input.userId) {
      throw new NotFoundException('Order not found');
    }

    const active = await this.findActive(tx, input.userId);
    if (active?.state === 'UNKNOWN') {
      return { outcome: 'reconciliation_required', attempt: toView(active) };
    }
    if (active?.state === 'CREATING') {
      if (isLeaseValid(active, now)) {
        return { outcome: 'in_progress', attempt: toView(active) };
      }
      const expired = await this.markExpiredCreatingUnknown(tx, active.id, now);
      return { outcome: 'reconciliation_required', attempt: expired };
    }

    const latest = await tx.billingCheckoutAttempt.findFirst({
      where: { orderId: input.orderId },
      orderBy: { generation: 'desc' },
      select: { generation: true },
    });
    const generation = (latest?.generation ?? 0) + 1;
    const leaseMs = input.leaseMs ?? CHECKOUT_ATTEMPT_LEASE_MS;
    const idempotencyKey = checkoutAttemptIdempotencyKey(
      input.orderId,
      generation,
    );

    try {
      const created = await tx.billingCheckoutAttempt.create({
        data: {
          userId: input.userId,
          orderId: input.orderId,
          generation,
          state: 'CREATING',
          idempotencyKey,
          leaseOwner: input.leaseOwner,
          leaseExpiresAt: new Date(now.getTime() + leaseMs),
        },
      });
      return { outcome: 'acquired', attempt: toView(created) };
    } catch (error) {
      if (!isUniqueConflict(error)) {
        throw error;
      }
      return this.resolveConflict(
        tx,
        input.userId,
        input.orderId,
        generation,
        now,
      );
    }
  }

  private async resolveConflict(
    tx: BillingTx,
    userId: string,
    orderId: string,
    generation: number,
    now: Date,
  ): Promise<AcquireCheckoutAttemptResult> {
    const winner =
      (await this.findActive(tx, userId)) ??
      (await tx.billingCheckoutAttempt.findUnique({
        where: { orderId_generation: { orderId, generation } },
      }));
    if (!winner || winner.userId !== userId) {
      throw new ConflictException(
        'Checkout attempt conflict could not be resolved',
      );
    }
    if (winner.state === 'UNKNOWN') {
      return { outcome: 'reconciliation_required', attempt: toView(winner) };
    }
    if (winner.state === 'CREATING' && isLeaseValid(winner, now)) {
      return { outcome: 'in_progress', attempt: toView(winner) };
    }
    if (winner.state === 'CREATING') {
      const expired = await this.markExpiredCreatingUnknown(tx, winner.id, now);
      return { outcome: 'reconciliation_required', attempt: expired };
    }
    return { outcome: 'in_progress', attempt: toView(winner) };
  }

  private async markExpiredCreatingUnknown(
    tx: BillingTx,
    id: string,
    now: Date,
  ): Promise<CheckoutAttemptView> {
    const error = sanitizeCheckoutAttemptError({
      code: 'lease_expired',
      message: 'Checkout attempt lease expired before completion',
    });
    const updated = await tx.billingCheckoutAttempt.updateMany({
      where: { id, state: 'CREATING' },
      data: {
        state: 'UNKNOWN',
        lastErrorCode: error.lastErrorCode,
        lastErrorMessage: error.lastErrorMessage,
        completedAt: now,
      },
    });
    if (updated.count !== 1) {
      const current = await tx.billingCheckoutAttempt.findUnique({
        where: { id },
      });
      if (current) {
        return toView(current);
      }
      throw new NotFoundException('Checkout attempt not found');
    }
    const current = await tx.billingCheckoutAttempt.findUniqueOrThrow({
      where: { id },
    });
    return toView(current);
  }

  private async findActive(tx: BillingTx, userId: string) {
    return tx.billingCheckoutAttempt.findFirst({
      where: {
        userId,
        state: { in: [...ACTIVE_CHECKOUT_ATTEMPT_STATES] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async withUserLock<T>(
    id: string,
    work: (
      tx: BillingTx,
      current: CheckoutAttemptView,
      now: Date,
    ) => Promise<T>,
    now?: Date,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.billingCheckoutAttempt.findUnique({
        where: { id },
      });
      if (!current) {
        throw new NotFoundException('Checkout attempt not found');
      }
      await acquireCheckoutUserLock(tx, current.userId);
      const locked = await tx.billingCheckoutAttempt.findUnique({
        where: { id },
      });
      if (!locked) {
        throw new NotFoundException('Checkout attempt not found');
      }
      return work(tx, toView(locked), now ?? new Date());
    });
  }

  private assertMutableByOwner(
    current: CheckoutAttemptView,
    leaseOwner: string,
    now: Date,
    states: AttemptState[],
  ) {
    if (!states.includes(current.state)) {
      throw new ConflictException(
        `Checkout attempt cannot leave ${current.state}`,
      );
    }
    if (!isLeaseValid(current, now, leaseOwner)) {
      throw new ConflictException(
        'Checkout attempt lease is not owned or expired',
      );
    }
  }

  private async updateAttempt(
    tx: BillingTx,
    id: string,
    data: Prisma.BillingCheckoutAttemptUncheckedUpdateInput,
  ): Promise<CheckoutAttemptView> {
    const updated = await tx.billingCheckoutAttempt.update({
      where: { id },
      data,
    });
    return toView(updated);
  }
}
