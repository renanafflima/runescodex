-- Global Rewards rotation: one shared selection per UTC cycle for all users.
-- Does not touch wallets, ledger, receipts, progress, or redemptions.

CREATE TABLE IF NOT EXISTS "RewardGlobalRotation" (
  "id" TEXT NOT NULL,
  "cycleKey" TEXT NOT NULL,
  "period" "RewardMissionPeriod" NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "missionIds" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardGlobalRotation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RewardGlobalRotation_period_periodStart_key"
ON "RewardGlobalRotation"("period", "periodStart");

CREATE INDEX IF NOT EXISTS "RewardGlobalRotation_cycleKey_idx"
ON "RewardGlobalRotation"("cycleKey");

CREATE INDEX IF NOT EXISTS "RewardGlobalRotation_period_periodStart_idx"
ON "RewardGlobalRotation"("period", "periodStart");
