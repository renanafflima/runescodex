-- CreateEnum
CREATE TYPE "BosstiaryHuntMode" AS ENUM ('SOLO', 'PARTY');

-- CreateEnum
CREATE TYPE "BosstiaryAccessStatus" AS ENUM ('UNKNOWN', 'NONE', 'REQUIRED');

-- CreateEnum
CREATE TYPE "BosstiaryRotationKind" AS ENUM ('EXPRESS', 'PROGRESSION', 'ALTERNATIVE');

-- CreateTable
CREATE TABLE "BosstiaryBoss" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "officialCategory" TEXT,
    "huntMode" "BosstiaryHuntMode",
    "recommendedLevelSolo" INTEGER,
    "recommendedLevelParty" INTEGER,
    "difficulty" "Difficulty",
    "locationName" TEXT,
    "locationRegion" TEXT,
    "originCity" TEXT,
    "accessStatus" "BosstiaryAccessStatus" NOT NULL DEFAULT 'UNKNOWN',
    "accessRequirements" TEXT,
    "howToReach" TEXT,
    "cooldownSeconds" INTEGER,
    "estimatedCombatMinutes" INTEGER,
    "bossPoints" INTEGER,
    "mechanics" TEXT,
    "strategy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BosstiaryBoss_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BosstiaryBossVocation" (
    "id" TEXT NOT NULL,
    "bossId" TEXT NOT NULL,
    "vocation" "Vocation" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BosstiaryBossVocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BosstiaryTravelEdge" (
    "id" TEXT NOT NULL,
    "fromCity" TEXT NOT NULL,
    "toCity" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "method" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BosstiaryTravelEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BosstiaryRotation" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "BosstiaryRotationKind" NOT NULL,
    "huntMode" "BosstiaryHuntMode" NOT NULL,
    "recommendedLevel" INTEGER,
    "originCity" TEXT,
    "reason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BosstiaryRotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BosstiaryRotationStop" (
    "id" TEXT NOT NULL,
    "rotationId" TEXT NOT NULL,
    "bossId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "travelMinutes" INTEGER,

    CONSTRAINT "BosstiaryRotationStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BosstiaryComment" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "content" TEXT NOT NULL,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BosstiaryComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BosstiaryCommentLike" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BosstiaryCommentLike_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BosstiaryBoss_slug_key" ON "BosstiaryBoss"("slug");
CREATE INDEX "BosstiaryBoss_isActive_idx" ON "BosstiaryBoss"("isActive");
CREATE INDEX "BosstiaryBoss_huntMode_idx" ON "BosstiaryBoss"("huntMode");
CREATE INDEX "BosstiaryBoss_originCity_idx" ON "BosstiaryBoss"("originCity");
CREATE INDEX "BosstiaryBoss_isActive_huntMode_name_idx" ON "BosstiaryBoss"("isActive", "huntMode", "name");
CREATE UNIQUE INDEX "BosstiaryBossVocation_bossId_vocation_key" ON "BosstiaryBossVocation"("bossId", "vocation");
CREATE INDEX "BosstiaryBossVocation_vocation_idx" ON "BosstiaryBossVocation"("vocation");
CREATE UNIQUE INDEX "BosstiaryTravelEdge_fromCity_toCity_key" ON "BosstiaryTravelEdge"("fromCity", "toCity");
CREATE INDEX "BosstiaryTravelEdge_fromCity_idx" ON "BosstiaryTravelEdge"("fromCity");
CREATE UNIQUE INDEX "BosstiaryRotation_slug_key" ON "BosstiaryRotation"("slug");
CREATE INDEX "BosstiaryRotation_isActive_huntMode_idx" ON "BosstiaryRotation"("isActive", "huntMode");
CREATE UNIQUE INDEX "BosstiaryRotationStop_rotationId_position_key" ON "BosstiaryRotationStop"("rotationId", "position");
CREATE UNIQUE INDEX "BosstiaryRotationStop_rotationId_bossId_key" ON "BosstiaryRotationStop"("rotationId", "bossId");
CREATE INDEX "BosstiaryRotationStop_bossId_idx" ON "BosstiaryRotationStop"("bossId");
CREATE INDEX "BosstiaryComment_slug_idx" ON "BosstiaryComment"("slug");
CREATE INDEX "BosstiaryComment_userId_idx" ON "BosstiaryComment"("userId");
CREATE INDEX "BosstiaryComment_parentId_idx" ON "BosstiaryComment"("parentId");
CREATE INDEX "BosstiaryComment_createdAt_idx" ON "BosstiaryComment"("createdAt");
CREATE INDEX "BosstiaryComment_slug_parentId_createdAt_id_idx" ON "BosstiaryComment"("slug", "parentId", "createdAt", "id");
CREATE UNIQUE INDEX "BosstiaryCommentLike_commentId_userId_key" ON "BosstiaryCommentLike"("commentId", "userId");
CREATE INDEX "BosstiaryCommentLike_userId_idx" ON "BosstiaryCommentLike"("userId");

ALTER TABLE "BosstiaryBossVocation" ADD CONSTRAINT "BosstiaryBossVocation_bossId_fkey" FOREIGN KEY ("bossId") REFERENCES "BosstiaryBoss"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BosstiaryRotationStop" ADD CONSTRAINT "BosstiaryRotationStop_rotationId_fkey" FOREIGN KEY ("rotationId") REFERENCES "BosstiaryRotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BosstiaryRotationStop" ADD CONSTRAINT "BosstiaryRotationStop_bossId_fkey" FOREIGN KEY ("bossId") REFERENCES "BosstiaryBoss"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BosstiaryComment" ADD CONSTRAINT "BosstiaryComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BosstiaryComment" ADD CONSTRAINT "BosstiaryComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BosstiaryComment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BosstiaryCommentLike" ADD CONSTRAINT "BosstiaryCommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "BosstiaryComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BosstiaryCommentLike" ADD CONSTRAINT "BosstiaryCommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
