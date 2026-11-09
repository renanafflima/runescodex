-- Personal Bosstiary diary (kills/drops) and per-user checklist.
-- History rows stay when a rotation is removed (SET NULL) and when checklist is toggled.

CREATE TYPE "BosstiaryActivityKind" AS ENUM ('BOSS_KILL', 'DROP');
CREATE TYPE "BosstiaryVisibility" AS ENUM ('PRIVATE', 'PUBLIC', 'GROUP');

CREATE TABLE "BosstiaryProgressActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "BosstiaryActivityKind" NOT NULL,
    "bossId" TEXT,
    "bossName" TEXT NOT NULL,
    "rotationId" TEXT,
    "rotationTitle" TEXT,
    "itemName" TEXT,
    "itemQuantity" INTEGER,
    "note" TEXT,
    "visibility" "BosstiaryVisibility" NOT NULL DEFAULT 'PRIVATE',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "partySessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BosstiaryProgressActivity_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BosstiaryProgressActivity_boss_name_not_empty" CHECK (length(btrim("bossName")) > 0),
    CONSTRAINT "BosstiaryProgressActivity_drop_qty_positive" CHECK (
      "kind" <> 'DROP' OR ("itemQuantity" IS NOT NULL AND "itemQuantity" > 0)
    ),
    CONSTRAINT "BosstiaryProgressActivity_drop_item_not_empty" CHECK (
      "kind" <> 'DROP' OR (length(btrim(COALESCE("itemName", ''))) > 0)
    )
);

CREATE TABLE "BosstiaryBossChecklist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bossId" TEXT NOT NULL,
    "defeated" BOOLEAN NOT NULL DEFAULT false,
    "lastDefeatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BosstiaryBossChecklist_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BosstiaryProgressActivity_userId_occurredAt_idx"
ON "BosstiaryProgressActivity"("userId", "occurredAt");

CREATE INDEX "BosstiaryProgressActivity_userId_kind_occurredAt_idx"
ON "BosstiaryProgressActivity"("userId", "kind", "occurredAt");

CREATE INDEX "BosstiaryProgressActivity_bossId_idx"
ON "BosstiaryProgressActivity"("bossId");

CREATE INDEX "BosstiaryProgressActivity_rotationId_idx"
ON "BosstiaryProgressActivity"("rotationId");

CREATE INDEX "BosstiaryProgressActivity_userId_visibility_idx"
ON "BosstiaryProgressActivity"("userId", "visibility");

CREATE UNIQUE INDEX "BosstiaryBossChecklist_userId_bossId_key"
ON "BosstiaryBossChecklist"("userId", "bossId");

CREATE INDEX "BosstiaryBossChecklist_userId_defeated_idx"
ON "BosstiaryBossChecklist"("userId", "defeated");

ALTER TABLE "BosstiaryProgressActivity"
ADD CONSTRAINT "BosstiaryProgressActivity_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BosstiaryProgressActivity"
ADD CONSTRAINT "BosstiaryProgressActivity_bossId_fkey"
FOREIGN KEY ("bossId") REFERENCES "BosstiaryBoss"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BosstiaryProgressActivity"
ADD CONSTRAINT "BosstiaryProgressActivity_rotationId_fkey"
FOREIGN KEY ("rotationId") REFERENCES "CommunityRotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BosstiaryBossChecklist"
ADD CONSTRAINT "BosstiaryBossChecklist_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BosstiaryBossChecklist"
ADD CONSTRAINT "BosstiaryBossChecklist_bossId_fkey"
FOREIGN KEY ("bossId") REFERENCES "BosstiaryBoss"("id") ON DELETE CASCADE ON UPDATE CASCADE;
