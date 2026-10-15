-- CreateEnum
CREATE TYPE "BillingMarket" AS ENUM ('BR', 'INTL');

-- CreateEnum
CREATE TYPE "BillingCurrency" AS ENUM ('BRL', 'USD');

-- CreateEnum
CREATE TYPE "BillingOrderStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "BillingPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "BillingLicenseStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "BillingEventType" AS ENUM ('PAYMENT_PAID', 'PAYMENT_FAILED', 'PAYMENT_REFUNDED');

-- CreateTable
CREATE TABLE "BillingProduct" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPrice" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "market" "BillingMarket" NOT NULL,
    "currency" "BillingCurrency" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPrice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BillingPrice_amount_positive" CHECK ("amountMinor" > 0)
);

-- CreateTable
CREATE TABLE "BillingOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priceId" TEXT NOT NULL,
    "market" "BillingMarket" NOT NULL,
    "currency" "BillingCurrency" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "status" "BillingOrderStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingOrder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BillingOrder_amount_positive" CHECK ("amountMinor" > 0)
);

-- CreateTable
CREATE TABLE "BillingPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "status" "BillingPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "currency" "BillingCurrency" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BillingPayment_amount_positive" CHECK ("amountMinor" > 0)
);

-- CreateTable
CREATE TABLE "BillingLicense" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "BillingLicenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "activeUserProductKey" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingLicense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEventReceipt" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "type" "BillingEventType" NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEventReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingProduct_code_key" ON "BillingProduct"("code");

-- CreateIndex
CREATE INDEX "BillingProduct_active_idx" ON "BillingProduct"("active");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPrice_productId_market_key" ON "BillingPrice"("productId", "market");

-- CreateIndex
CREATE INDEX "BillingPrice_productId_active_idx" ON "BillingPrice"("productId", "active");

-- CreateIndex
CREATE INDEX "BillingOrder_userId_createdAt_idx" ON "BillingOrder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingOrder_productId_idx" ON "BillingOrder"("productId");

-- CreateIndex
CREATE INDEX "BillingOrder_status_idx" ON "BillingOrder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPayment_provider_providerPaymentId_key" ON "BillingPayment"("provider", "providerPaymentId");

-- CreateIndex
CREATE INDEX "BillingPayment_orderId_idx" ON "BillingPayment"("orderId");

-- CreateIndex
CREATE INDEX "BillingPayment_status_idx" ON "BillingPayment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BillingLicense_orderId_key" ON "BillingLicense"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingLicense_activeUserProductKey_key" ON "BillingLicense"("activeUserProductKey");

-- CreateIndex
CREATE INDEX "BillingLicense_userId_productId_status_idx" ON "BillingLicense"("userId", "productId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BillingEventReceipt_provider_providerEventId_key" ON "BillingEventReceipt"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "BillingEventReceipt_orderId_idx" ON "BillingEventReceipt"("orderId");

-- CreateIndex
CREATE INDEX "BillingEventReceipt_paymentId_idx" ON "BillingEventReceipt"("paymentId");

-- AddForeignKey
ALTER TABLE "BillingPrice" ADD CONSTRAINT "BillingPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "BillingProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingOrder" ADD CONSTRAINT "BillingOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingOrder" ADD CONSTRAINT "BillingOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "BillingProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingOrder" ADD CONSTRAINT "BillingOrder_priceId_fkey" FOREIGN KEY ("priceId") REFERENCES "BillingPrice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "BillingOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingLicense" ADD CONSTRAINT "BillingLicense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingLicense" ADD CONSTRAINT "BillingLicense_productId_fkey" FOREIGN KEY ("productId") REFERENCES "BillingProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingLicense" ADD CONSTRAINT "BillingLicense_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "BillingOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEventReceipt" ADD CONSTRAINT "BillingEventReceipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "BillingOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEventReceipt" ADD CONSTRAINT "BillingEventReceipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "BillingPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Catalog for the one-time Premium product. Amounts are minor units.
INSERT INTO "BillingProduct" ("id", "code", "name", "active", "createdAt", "updatedAt")
VALUES (
    'c0ffee00-0000-4000-8000-000000000001',
    'RUNECODEX_PREMIUM',
    'RuneCodex Premium',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

INSERT INTO "BillingPrice" ("id", "productId", "market", "currency", "amountMinor", "active", "createdAt", "updatedAt")
VALUES
    (
        'c0ffee00-0000-4000-8000-0000000000b1',
        'c0ffee00-0000-4000-8000-000000000001',
        'BR',
        'BRL',
        4990,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'c0ffee00-0000-4000-8000-0000000000b2',
        'c0ffee00-0000-4000-8000-000000000001',
        'INTL',
        'USD',
        1499,
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );
