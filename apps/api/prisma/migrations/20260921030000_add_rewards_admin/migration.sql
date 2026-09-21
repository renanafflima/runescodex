-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

-- AlterTable
ALTER TABLE "RewardRedemption" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "RewardRedemption" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "RewardRedemption" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "RewardRedemption" ADD COLUMN "refundedAt" TIMESTAMP(3);
ALTER TABLE "RewardRedemption" ADD COLUMN "approvedByUserId" TEXT;
ALTER TABLE "RewardRedemption" ADD COLUMN "deliveredByUserId" TEXT;
ALTER TABLE "RewardRedemption" ADD COLUMN "cancelledByUserId" TEXT;
ALTER TABLE "RewardRedemption" ADD COLUMN "adminNote" TEXT;
ALTER TABLE "RewardRedemption" ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "RewardRedemption" ADD COLUMN "deliveryNote" TEXT;

-- CreateTable
CREATE TABLE "RewardRedemptionStatusEvent" (
    "id" TEXT NOT NULL,
    "redemptionId" TEXT NOT NULL,
    "fromStatus" "RewardRedemptionStatus",
    "toStatus" "RewardRedemptionStatus" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardRedemptionStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RewardRedemptionStatusEvent_redemptionId_createdAt_idx" ON "RewardRedemptionStatusEvent"("redemptionId", "createdAt");

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_deliveredByUserId_fkey" FOREIGN KEY ("deliveredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemptionStatusEvent" ADD CONSTRAINT "RewardRedemptionStatusEvent_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "RewardRedemption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemptionStatusEvent" ADD CONSTRAINT "RewardRedemptionStatusEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
