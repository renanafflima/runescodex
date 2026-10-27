-- Extends the existing billing license. Paid rows keep their order.
-- Grants and vouchers leave orderId null, so they do not create a sale.

ALTER TYPE "BillingLicenseStatus" ADD VALUE 'SUSPENDED';
ALTER TYPE "BillingLicenseStatus" ADD VALUE 'EXPIRED';

CREATE TYPE "BillingLicenseSource" AS ENUM ('PURCHASE', 'VOUCHER', 'ADMIN_GRANT', 'PARTNERSHIP', 'COMPENSATION');
CREATE TYPE "BillingLicenseTerm" AS ENUM ('LIFETIME', 'FIXED');
CREATE TYPE "BillingVoucherBenefit" AS ENUM ('FREE', 'PARTNERSHIP', 'PROMOTIONAL');
CREATE TYPE "BillingVoucherStatus" AS ENUM ('ACTIVE', 'PAUSED', 'EXHAUSTED', 'CLOSED');
CREATE TYPE "BillingRedemptionResult" AS ENUM ('SUCCESS', 'REJECTED');
CREATE TYPE "BillingGrantCategory" AS ENUM ('COLLABORATOR', 'PARTNERSHIP', 'CONTENT_CREATOR', 'COMPENSATION', 'OTHER');

ALTER TABLE "BillingPayment" ADD COLUMN "providerStatus" TEXT;
ALTER TABLE "BillingPayment" ADD COLUMN "syncedAt" TIMESTAMP(3);

ALTER TABLE "BillingLicense" ALTER COLUMN "orderId" DROP NOT NULL;
ALTER TABLE "BillingLicense" ADD COLUMN "source" "BillingLicenseSource" NOT NULL DEFAULT 'PURCHASE';
ALTER TABLE "BillingLicense" ADD COLUMN "term" "BillingLicenseTerm" NOT NULL DEFAULT 'LIFETIME';
ALTER TABLE "BillingLicense" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "BillingLicense" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "BillingLicense" ADD COLUMN "reason" TEXT;
ALTER TABLE "BillingLicense" ADD COLUMN "grantedByUserId" TEXT;

CREATE INDEX "BillingLicense_source_status_idx" ON "BillingLicense"("source", "status");
CREATE INDEX "BillingLicense_expiresAt_idx" ON "BillingLicense"("expiresAt");
CREATE INDEX "BillingLicense_grantedByUserId_idx" ON "BillingLicense"("grantedByUserId");

ALTER TABLE "BillingLicense"
ADD CONSTRAINT "BillingLicense_grantedByUserId_fkey"
FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "BillingVoucher" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codePrefix" TEXT NOT NULL,
    "benefit" "BillingVoucherBenefit" NOT NULL,
    "productId" TEXT NOT NULL,
    "term" "BillingLicenseTerm" NOT NULL,
    "durationDays" INTEGER,
    "maxRedemptions" INTEGER NOT NULL,
    "redeemedCount" INTEGER NOT NULL DEFAULT 0,
    "perUserLimit" INTEGER NOT NULL DEFAULT 1,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "status" "BillingVoucherStatus" NOT NULL DEFAULT 'ACTIVE',
    "campaign" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingVoucher_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingVoucher_codeHash_key" ON "BillingVoucher"("codeHash");
CREATE INDEX "BillingVoucher_status_endsAt_idx" ON "BillingVoucher"("status", "endsAt");
CREATE INDEX "BillingVoucher_createdByUserId_idx" ON "BillingVoucher"("createdByUserId");

ALTER TABLE "BillingVoucher"
ADD CONSTRAINT "BillingVoucher_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "BillingProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillingVoucher"
ADD CONSTRAINT "BillingVoucher_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "BillingVoucherRedemption" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "result" "BillingRedemptionResult" NOT NULL,
    "reason" TEXT,
    "licenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingVoucherRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingVoucherRedemption_licenseId_key" ON "BillingVoucherRedemption"("licenseId");
CREATE INDEX "BillingVoucherRedemption_voucherId_userId_idx" ON "BillingVoucherRedemption"("voucherId", "userId");
CREATE INDEX "BillingVoucherRedemption_userId_createdAt_idx" ON "BillingVoucherRedemption"("userId", "createdAt");

ALTER TABLE "BillingVoucherRedemption"
ADD CONSTRAINT "BillingVoucherRedemption_voucherId_fkey"
FOREIGN KEY ("voucherId") REFERENCES "BillingVoucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillingVoucherRedemption"
ADD CONSTRAINT "BillingVoucherRedemption_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillingVoucherRedemption"
ADD CONSTRAINT "BillingVoucherRedemption_licenseId_fkey"
FOREIGN KEY ("licenseId") REFERENCES "BillingLicense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "BillingLicenseGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "category" "BillingGrantCategory" NOT NULL,
    "reason" TEXT NOT NULL,
    "term" "BillingLicenseTerm" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "licenseId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingLicenseGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingLicenseGrant_licenseId_key" ON "BillingLicenseGrant"("licenseId");
CREATE INDEX "BillingLicenseGrant_userId_createdAt_idx" ON "BillingLicenseGrant"("userId", "createdAt");
CREATE INDEX "BillingLicenseGrant_actorUserId_idx" ON "BillingLicenseGrant"("actorUserId");
CREATE INDEX "BillingLicenseGrant_category_idx" ON "BillingLicenseGrant"("category");

ALTER TABLE "BillingLicenseGrant"
ADD CONSTRAINT "BillingLicenseGrant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillingLicenseGrant"
ADD CONSTRAINT "BillingLicenseGrant_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillingLicenseGrant"
ADD CONSTRAINT "BillingLicenseGrant_licenseId_fkey"
FOREIGN KEY ("licenseId") REFERENCES "BillingLicense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
