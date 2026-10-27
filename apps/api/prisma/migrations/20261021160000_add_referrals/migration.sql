-- Referral codes and one-time 100 TC rewards. Existing users keep a null code
-- until the account opens the referral area or registers after this migration.

ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

CREATE TYPE "ReferralStage" AS ENUM ('WAITING_PURCHASE', 'REWARDED');
CREATE TYPE "ReferralRewardStatus" AS ENUM ('PENDING_DELIVERY', 'DELIVERED', 'INELIGIBLE', 'ON_HOLD');

CREATE TABLE "ReferralAttribution" (
    "id" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "stage" "ReferralStage" NOT NULL DEFAULT 'WAITING_PURCHASE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReferralAttribution_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReferralAttribution_not_self" CHECK ("referrerUserId" <> "referredUserId")
);

CREATE UNIQUE INDEX "ReferralAttribution_referredUserId_key" ON "ReferralAttribution"("referredUserId");
CREATE INDEX "ReferralAttribution_referrerUserId_createdAt_idx" ON "ReferralAttribution"("referrerUserId", "createdAt");
CREATE INDEX "ReferralAttribution_code_idx" ON "ReferralAttribution"("code");

ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ReferralReward" (
    "id" TEXT NOT NULL,
    "attributionId" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "tibiaCoins" INTEGER NOT NULL DEFAULT 100,
    "status" "ReferralRewardStatus" NOT NULL DEFAULT 'PENDING_DELIVERY',
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT,
    "licenseId" TEXT,
    "ticketId" TEXT,
    "holdReason" TEXT,
    "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "reviewReason" TEXT,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "deliveredByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReferralReward_coins" CHECK ("tibiaCoins" = 100)
);

CREATE UNIQUE INDEX "ReferralReward_attributionId_key" ON "ReferralReward"("attributionId");
CREATE UNIQUE INDEX "ReferralReward_orderId_key" ON "ReferralReward"("orderId");
CREATE UNIQUE INDEX "ReferralReward_ticketId_key" ON "ReferralReward"("ticketId");
CREATE INDEX "ReferralReward_status_createdAt_idx" ON "ReferralReward"("status", "createdAt");
CREATE INDEX "ReferralReward_referrerUserId_createdAt_idx" ON "ReferralReward"("referrerUserId", "createdAt");

ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_attributionId_fkey" FOREIGN KEY ("attributionId") REFERENCES "ReferralAttribution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_deliveredByUserId_fkey" FOREIGN KEY ("deliveredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
