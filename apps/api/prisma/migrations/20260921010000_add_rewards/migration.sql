-- CreateEnum
CREATE TYPE "RewardMissionPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "RewardMissionCategory" AS ENUM ('BESTIARY', 'EXPLORATION', 'COMMUNITY', 'HUNT', 'RECRUITMENT', 'PROMOTION', 'KNOWLEDGE', 'MUSIC');

-- CreateEnum
CREATE TYPE "RewardCurrency" AS ENUM ('GOLD', 'DIAMOND');

-- CreateEnum
CREATE TYPE "RewardRedemptionStatus" AS ENUM ('PENDING', 'APPROVED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RewardLedgerType" AS ENUM ('MISSION_REWARD', 'POINTS_TO_GOLD', 'GOLD_TO_DIAMOND', 'REDEMPTION', 'REFUND', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "RewardWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "gold" INTEGER NOT NULL DEFAULT 0,
    "diamond" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardWallet_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RewardWallet_points_nonnegative" CHECK ("points" >= 0),
    CONSTRAINT "RewardWallet_gold_nonnegative" CHECK ("gold" >= 0),
    CONSTRAINT "RewardWallet_diamond_nonnegative" CHECK ("diamond" >= 0)
);

-- CreateTable
CREATE TABLE "RewardMission" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "RewardMissionCategory" NOT NULL,
    "period" "RewardMissionPeriod" NOT NULL,
    "target" INTEGER NOT NULL,
    "pointsReward" INTEGER NOT NULL,
    "imageKey" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardMission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMissionProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMissionProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardCatalogItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "currency" "RewardCurrency" NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardRedemption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "currency" "RewardCurrency" NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "RewardRedemptionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardLedgerEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "RewardLedgerType" NOT NULL,
    "pointsDelta" INTEGER NOT NULL DEFAULT 0,
    "goldDelta" INTEGER NOT NULL DEFAULT 0,
    "diamondDelta" INTEGER NOT NULL DEFAULT 0,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RewardWallet_userId_key" ON "RewardWallet"("userId");

-- CreateIndex
CREATE INDEX "RewardWallet_userId_idx" ON "RewardWallet"("userId");

-- CreateIndex
CREATE INDEX "RewardMission_active_period_idx" ON "RewardMission"("active", "period");

-- CreateIndex
CREATE INDEX "RewardMission_category_idx" ON "RewardMission"("category");

-- CreateIndex
CREATE UNIQUE INDEX "UserMissionProgress_userId_missionId_periodStart_key" ON "UserMissionProgress"("userId", "missionId", "periodStart");

-- CreateIndex
CREATE INDEX "UserMissionProgress_userId_idx" ON "UserMissionProgress"("userId");

-- CreateIndex
CREATE INDEX "UserMissionProgress_missionId_idx" ON "UserMissionProgress"("missionId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardCatalogItem_imageKey_key" ON "RewardCatalogItem"("imageKey");

-- CreateIndex
CREATE INDEX "RewardCatalogItem_active_sortOrder_idx" ON "RewardCatalogItem"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "RewardRedemption_userId_createdAt_idx" ON "RewardRedemption"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RewardRedemption_catalogItemId_idx" ON "RewardRedemption"("catalogItemId");

-- CreateIndex
CREATE INDEX "RewardRedemption_status_idx" ON "RewardRedemption"("status");

-- CreateIndex
CREATE INDEX "RewardLedgerEntry_userId_createdAt_idx" ON "RewardLedgerEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RewardLedgerEntry_walletId_idx" ON "RewardLedgerEntry"("walletId");

-- CreateIndex
CREATE INDEX "RewardLedgerEntry_type_idx" ON "RewardLedgerEntry"("type");

-- AddForeignKey
ALTER TABLE "RewardWallet" ADD CONSTRAINT "RewardWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMissionProgress" ADD CONSTRAINT "UserMissionProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMissionProgress" ADD CONSTRAINT "UserMissionProgress_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "RewardMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "RewardWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "RewardCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardLedgerEntry" ADD CONSTRAINT "RewardLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardLedgerEntry" ADD CONSTRAINT "RewardLedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "RewardWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
