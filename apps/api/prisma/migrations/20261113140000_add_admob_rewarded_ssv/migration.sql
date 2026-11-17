-- AdMob rewarded Server-Side Verification (SSV) sessions and processed transactions.

CREATE TABLE "AdMobRewardSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdMobRewardSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdMobRewardSession_transactionId_key"
ON "AdMobRewardSession"("transactionId");

CREATE INDEX "AdMobRewardSession_userId_createdAt_idx"
ON "AdMobRewardSession"("userId", "createdAt");

CREATE TABLE "AdMobSsvTransaction" (
    "transactionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "adUnitId" TEXT NOT NULL,
    "adNetwork" TEXT,
    "rewardAmount" INTEGER,
    "rewardItem" TEXT,
    "eventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdMobSsvTransaction_pkey" PRIMARY KEY ("transactionId")
);

CREATE INDEX "AdMobSsvTransaction_userId_createdAt_idx"
ON "AdMobSsvTransaction"("userId", "createdAt");

CREATE INDEX "AdMobSsvTransaction_sessionId_idx"
ON "AdMobSsvTransaction"("sessionId");

ALTER TABLE "AdMobRewardSession" ADD CONSTRAINT "AdMobRewardSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdMobSsvTransaction" ADD CONSTRAINT "AdMobSsvTransaction_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdMobSsvTransaction" ADD CONSTRAINT "AdMobSsvTransaction_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "AdMobRewardSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
