/**
 * Real PostgreSQL proofs for checkout reservations.
 *
 * Skipped unless:
 * - RUN_BILLING_CHECKOUT_PG=1
 * - DATABASE_URL points at development Postgres
 * - migration 20261103143000_billing_checkout_attempt is already applied
 *
 * Do not run against production. This session must not apply the migration.
 *
 * After applying the billing checkout attempt migration locally:
 *
 *   cd apps/api
 *   npx prisma migrate deploy
 *   $env:RUN_BILLING_CHECKOUT_PG = "1"
 *   npm test -- billing-checkout.pg.spec.ts
 *
 * These tests open two independent PrismaClient instances against the same
 * database. Jest mocks are not used to claim concurrency was proven.
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import { BillingCheckoutAttemptService } from './billing-checkout-attempt.service';
import { checkoutAttemptIdempotencyKey } from './billing-checkout-attempt.sanitize';

const enabled =
  process.env.RUN_BILLING_CHECKOUT_PG === '1' &&
  Boolean(process.env.DATABASE_URL);

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

(enabled ? describe : describe.skip)(
  'BillingCheckout PostgreSQL concurrency',
  () => {
    let primary: PrismaClient;
    let secondary: PrismaClient;
    let left: BillingCheckoutAttemptService;
    let right: BillingCheckoutAttemptService;
    let userId: string;
    let orderId: string;
    let amountMinor: number;
    let currency: 'BRL' | 'USD';
    const now = new Date('2026-11-03T18:00:00.000Z');

    beforeAll(async () => {
      primary = createClient();
      secondary = createClient();
      const table = await primary.$queryRaw<Array<{ name: string | null }>>`
        SELECT to_regclass('public."BillingCheckoutAttempt"')::text AS name
      `;
      if (!table[0]?.name) {
        throw new Error(
          'BillingCheckoutAttempt is missing. Apply 20261103143000_billing_checkout_attempt on development first.',
        );
      }
      const product = await primary.billingProduct.findFirst({
        where: { code: 'RUNECODEX_PREMIUM' },
      });
      const price = product
        ? await primary.billingPrice.findFirst({
            where: { productId: product.id, market: 'BR' },
          })
        : null;
      if (!product || !price) {
        throw new Error(
          'Billing product/price rows are required for PostgreSQL checkout tests.',
        );
      }
      const user = await primary.user.create({
        data: {
          email: `checkout-pg-${crypto.randomUUID()}@example.invalid`,
          passwordHash: 'pg-test',
        },
      });
      userId = user.id;
      const order = await primary.billingOrder.create({
        data: {
          userId,
          productId: product.id,
          priceId: price.id,
          market: 'BR',
          currency: price.currency,
          amountMinor: price.amountMinor,
          status: 'PENDING',
        },
      });
      orderId = order.id;
      amountMinor = order.amountMinor;
      currency = order.currency;
      left = new BillingCheckoutAttemptService(primary as never);
      right = new BillingCheckoutAttemptService(secondary as never);
    });

    afterAll(async () => {
      if (orderId) {
        await primary.billingCheckoutAttempt.deleteMany({ where: { orderId } });
        await primary.billingPayment.deleteMany({ where: { orderId } });
        await primary.billingOrder.delete({ where: { id: orderId } });
      }
      if (userId) {
        await primary.user
          .delete({ where: { id: userId } })
          .catch(() => undefined);
      }
      await primary?.$disconnect();
      await secondary?.$disconnect();
    });

    it('lets only one of two concurrent transactions acquire CREATING', async () => {
      const results = await Promise.all([
        left.acquire({
          userId,
          orderId,
          leaseOwner: 'worker-a',
          now,
        }),
        right.acquire({
          userId,
          orderId,
          leaseOwner: 'worker-b',
          now,
        }),
      ]);
      expect(results.map((row) => row.outcome).sort()).toEqual([
        'acquired',
        'in_progress',
      ]);
      const rows = await primary.billingCheckoutAttempt.findMany({
        where: { orderId },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].state).toBe('CREATING');
    });

    it('enforces the partial unique index across two clients', async () => {
      const current = await primary.billingCheckoutAttempt.findMany({
        where: { userId, state: { in: ['CREATING', 'UNKNOWN'] } },
      });
      for (const row of current) {
        await primary.billingCheckoutAttempt.update({
          where: { id: row.id },
          data: { state: 'FAILED', leaseOwner: null, leaseExpiresAt: null },
        });
      }
      const first = await primary.billingCheckoutAttempt.create({
        data: {
          userId,
          orderId,
          generation: 80,
          state: 'CREATING',
          idempotencyKey: checkoutAttemptIdempotencyKey(orderId, 80),
          leaseOwner: 'lock-a',
          leaseExpiresAt: new Date(now.getTime() + 60_000),
        },
      });
      await expect(
        secondary.billingCheckoutAttempt.create({
          data: {
            userId,
            orderId,
            generation: 81,
            state: 'UNKNOWN',
            idempotencyKey: checkoutAttemptIdempotencyKey(orderId, 81),
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
      await primary.billingCheckoutAttempt.update({
        where: { id: first.id },
        data: { state: 'FAILED' },
      });
    });

    it('rolls back READY when BillingPayment persist throws', async () => {
      const acquired = await left.acquire({
        userId,
        orderId,
        leaseOwner: 'worker-ready',
        now,
      });
      expect(acquired.outcome).toBe('acquired');
      await expect(
        left.completeReady(
          {
            id: acquired.attempt.id,
            leaseOwner: 'worker-ready',
            providerCheckoutId: 'pref-pg',
            expectedUserId: userId,
            expectedOrderId: orderId,
            now,
          },
          async (tx) => {
            await tx.billingPayment.create({
              data: {
                orderId,
                provider: 'mercadopago',
                providerCheckoutId: 'pref-pg',
                status: 'PENDING',
                currency,
                amountMinor,
              },
            });
            throw new Error('forced persist failure');
          },
        ),
      ).rejects.toThrow('forced persist failure');
      const attempt = await primary.billingCheckoutAttempt.findUniqueOrThrow({
        where: { id: acquired.attempt.id },
      });
      expect(attempt.state).toBe('CREATING');
      expect(attempt.billingPaymentId).toBeNull();
      const payments = await primary.billingPayment.findMany({
        where: { orderId, providerCheckoutId: 'pref-pg' },
      });
      expect(payments).toHaveLength(0);
      await primary.billingCheckoutAttempt.update({
        where: { id: attempt.id },
        data: { state: 'FAILED', leaseOwner: null, leaseExpiresAt: null },
      });
    });

    it('keeps UNKNOWN blocking a new generation until reconcileUnknown', async () => {
      const acquired = await left.acquire({
        userId,
        orderId,
        leaseOwner: 'worker-unknown',
        now,
      });
      expect(acquired.outcome).toBe('acquired');
      await left.markUnknown({
        id: acquired.attempt.id,
        leaseOwner: 'worker-unknown',
        errorCode: 'timeout',
        now,
      });
      const blocked = await right.acquire({
        userId,
        orderId,
        leaseOwner: 'worker-next',
        now,
      });
      expect(blocked.outcome).toBe('reconciliation_required');
      const payment = await primary.billingPayment.create({
        data: {
          orderId,
          provider: 'mercadopago',
          providerCheckoutId: 'pref-unknown',
          status: 'PENDING',
          currency,
          amountMinor,
        },
      });
      await left.reconcileUnknown({
        id: acquired.attempt.id,
        outcome: 'READY',
        providerCheckoutId: 'pref-unknown',
        billingPaymentId: payment.id,
        now,
      });
      const next = await right.acquire({
        userId,
        orderId,
        leaseOwner: 'worker-after',
        now,
      });
      expect(next.outcome).toBe('acquired');
      expect(next.attempt.generation).toBeGreaterThan(
        acquired.attempt.generation,
      );
    });
  },
);
