-- CreateEnum
CREATE TYPE "BillingCheckoutAttemptState" AS ENUM (
    'CREATING',
    'READY',
    'FAILED',
    'UNKNOWN'
);

-- CreateTable
CREATE TABLE "BillingCheckoutAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "state" "BillingCheckoutAttemptState" NOT NULL DEFAULT 'CREATING',
    "idempotencyKey" TEXT NOT NULL,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "providerCheckoutId" TEXT,
    "billingPaymentId" TEXT,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BillingCheckoutAttempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BillingCheckoutAttempt_generation_positive" CHECK ("generation" > 0),
    CONSTRAINT "BillingCheckoutAttempt_idempotency_key_not_empty" CHECK (length(btrim("idempotencyKey")) > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingCheckoutAttempt_idempotencyKey_key"
ON "BillingCheckoutAttempt"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCheckoutAttempt_billingPaymentId_key"
ON "BillingCheckoutAttempt"("billingPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCheckoutAttempt_orderId_generation_key"
ON "BillingCheckoutAttempt"("orderId", "generation");

-- CreateIndex
CREATE INDEX "BillingCheckoutAttempt_userId_state_idx"
ON "BillingCheckoutAttempt"("userId", "state");

-- CreateIndex
CREATE INDEX "BillingCheckoutAttempt_orderId_idx"
ON "BillingCheckoutAttempt"("orderId");

-- CreateIndex
CREATE INDEX "BillingCheckoutAttempt_leaseExpiresAt_idx"
ON "BillingCheckoutAttempt"("leaseExpiresAt");

-- CreateIndex
CREATE INDEX "BillingCheckoutAttempt_state_updatedAt_idx"
ON "BillingCheckoutAttempt"("state", "updatedAt");

-- At most one durable reservation can be active per user across all orders.
-- READY and FAILED attempts remain as unrestricted financial history.
-- This partial unique index is SQL-only. Prisma schema cannot represent it.
-- Do not DROP INDEX "BillingCheckoutAttempt_one_active_per_user_key" in later
-- migrations, and do not replace it with a non-partial unique on userId.
CREATE UNIQUE INDEX "BillingCheckoutAttempt_one_active_per_user_key"
ON "BillingCheckoutAttempt"("userId")
WHERE "state" IN ('CREATING', 'UNKNOWN');

-- AddForeignKey
ALTER TABLE "BillingCheckoutAttempt"
ADD CONSTRAINT "BillingCheckoutAttempt_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCheckoutAttempt"
ADD CONSTRAINT "BillingCheckoutAttempt_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "BillingOrder"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCheckoutAttempt"
ADD CONSTRAINT "BillingCheckoutAttempt_billingPaymentId_fkey"
FOREIGN KEY ("billingPaymentId") REFERENCES "BillingPayment"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
