-- Pending administrative Premium offers for emails without an account yet.
-- A license is created only after that email authenticates and claims the offer.

CREATE TYPE "BillingPendingGrantStatus" AS ENUM ('PENDING', 'CLAIMED', 'CANCELLED', 'EXPIRED');

CREATE TABLE "BillingPendingLicenseGrant" (
    "id" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "category" "BillingGrantCategory" NOT NULL,
    "reason" TEXT NOT NULL,
    "term" "BillingLicenseTerm" NOT NULL,
    "durationDays" INTEGER,
    "status" "BillingPendingGrantStatus" NOT NULL DEFAULT 'PENDING',
    "offerExpiresAt" TIMESTAMP(3),
    "claimedUserId" TEXT,
    "claimedLicenseId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingPendingLicenseGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingPendingLicenseGrant_claimedLicenseId_key" ON "BillingPendingLicenseGrant"("claimedLicenseId");
CREATE INDEX "BillingPendingLicenseGrant_emailNormalized_status_idx" ON "BillingPendingLicenseGrant"("emailNormalized", "status");
CREATE INDEX "BillingPendingLicenseGrant_status_offerExpiresAt_idx" ON "BillingPendingLicenseGrant"("status", "offerExpiresAt");
CREATE INDEX "BillingPendingLicenseGrant_actorUserId_createdAt_idx" ON "BillingPendingLicenseGrant"("actorUserId", "createdAt");
CREATE UNIQUE INDEX "BillingPendingLicenseGrant_pending_email_product_key" ON "BillingPendingLicenseGrant"("emailNormalized", "productId") WHERE "status" = 'PENDING';

ALTER TABLE "BillingPendingLicenseGrant" ADD CONSTRAINT "BillingPendingLicenseGrant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "BillingProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingPendingLicenseGrant" ADD CONSTRAINT "BillingPendingLicenseGrant_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingPendingLicenseGrant" ADD CONSTRAINT "BillingPendingLicenseGrant_claimedUserId_fkey" FOREIGN KEY ("claimedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingPendingLicenseGrant" ADD CONSTRAINT "BillingPendingLicenseGrant_claimedLicenseId_fkey" FOREIGN KEY ("claimedLicenseId") REFERENCES "BillingLicense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
