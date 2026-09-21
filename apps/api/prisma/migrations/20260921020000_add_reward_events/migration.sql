-- AlterTable
ALTER TABLE "RewardMission" ADD COLUMN "eventType" TEXT;

-- CreateIndex
CREATE INDEX "RewardMission_eventType_active_idx" ON "RewardMission"("eventType", "active");

-- CreateTable
CREATE TABLE "RewardEventReceipt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardEventReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RewardEventReceipt_userId_eventType_referenceId_missionId_periodStart_key" ON "RewardEventReceipt"("userId", "eventType", "referenceId", "missionId", "periodStart");

-- CreateIndex
CREATE INDEX "RewardEventReceipt_userId_eventType_idx" ON "RewardEventReceipt"("userId", "eventType");

-- AddForeignKey
ALTER TABLE "RewardEventReceipt" ADD CONSTRAINT "RewardEventReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardEventReceipt" ADD CONSTRAINT "RewardEventReceipt_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "RewardMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
