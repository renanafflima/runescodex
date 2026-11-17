-- Rewards mission catalog v2: pool keys, roles, implementation flags, cycle completions.
-- Does not delete historical missions, wallets, ledger, or receipts.

ALTER TABLE "RewardMission"
ADD COLUMN IF NOT EXISTS "catalogKey" TEXT,
ADD COLUMN IF NOT EXISTS "pillar" TEXT,
ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'LEGACY',
ADD COLUMN IF NOT EXISTS "eventImplemented" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "RewardMission_catalogKey_period_key"
ON "RewardMission"("catalogKey", "period")
WHERE "catalogKey" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "RewardMission_role_period_active_idx"
ON "RewardMission"("role", "period", "active");

CREATE TABLE IF NOT EXISTS "UserRewardCycleCompletion" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "cycle" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  CONSTRAINT "UserRewardCycleCompletion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserRewardCycleCompletion_userId_cycle_periodStart_key"
ON "UserRewardCycleCompletion"("userId", "cycle", "periodStart");

CREATE INDEX IF NOT EXISTS "UserRewardCycleCompletion_userId_cycle_idx"
ON "UserRewardCycleCompletion"("userId", "cycle");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserRewardCycleCompletion_userId_fkey'
  ) THEN
    ALTER TABLE "UserRewardCycleCompletion"
    ADD CONSTRAINT "UserRewardCycleCompletion_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;