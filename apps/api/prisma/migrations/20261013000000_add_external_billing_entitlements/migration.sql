CREATE TABLE "BillingStoreEntitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingStoreEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingStoreEntitlement_userId_provider_productId_key"
    ON "BillingStoreEntitlement"("userId", "provider", "productId");

CREATE INDEX "BillingStoreEntitlement_provider_productId_active_idx"
    ON "BillingStoreEntitlement"("provider", "productId", "active");

ALTER TABLE "BillingStoreEntitlement"
    ADD CONSTRAINT "BillingStoreEntitlement_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillingStoreEntitlement"
    ADD CONSTRAINT "BillingStoreEntitlement_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "BillingProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
