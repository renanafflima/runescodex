-- Community boss rotations (player-published), separate from BosstiaryRotation planner.

CREATE TYPE "CommunityRotationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN', 'REMOVED');
CREATE TYPE "CommunityRotationRecommendedLevel" AS ENUM ('L300', 'L500', 'L700', 'L1000_PLUS');
CREATE TYPE "CommunityRotationSort" AS ENUM ('LIKES', 'RECENT', 'COMMENTS');

CREATE TABLE "CommunityRotation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "accessRequirements" TEXT,
    "additionalInfo" TEXT,
    "recommendedLevel" "CommunityRotationRecommendedLevel" NOT NULL,
    "huntMode" "BosstiaryHuntMode" NOT NULL,
    "plannedDurationMinutes" INTEGER NOT NULL,
    "vocation" "Vocation",
    "characterLevel" INTEGER,
    "partySize" INTEGER,
    "observedTotalMinutes" INTEGER,
    "combatMinutes" INTEGER,
    "travelMinutes" INTEGER,
    "status" "CommunityRotationStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityRotation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunityRotationBoss" (
    "id" TEXT NOT NULL,
    "rotationId" TEXT NOT NULL,
    "bossId" TEXT,
    "bossName" TEXT,
    "position" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityRotationBoss_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunityRotationLike" (
    "id" TEXT NOT NULL,
    "rotationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityRotationLike_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunityRotationFavorite" (
    "id" TEXT NOT NULL,
    "rotationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityRotationFavorite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunityRotationComment" (
    "id" TEXT NOT NULL,
    "rotationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "content" TEXT NOT NULL,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityRotationComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunityRotationCommentLike" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityRotationCommentLike_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunityRotationTest" (
    "id" TEXT NOT NULL,
    "rotationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vocation" "Vocation",
    "characterLevel" INTEGER,
    "partySize" INTEGER,
    "combatMinutes" INTEGER,
    "travelMinutes" INTEGER,
    "totalMinutes" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityRotationTest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunityRotationBoss_rotationId_position_key" ON "CommunityRotationBoss"("rotationId", "position");
CREATE INDEX "CommunityRotationBoss_bossId_idx" ON "CommunityRotationBoss"("bossId");
CREATE INDEX "CommunityRotationBoss_rotationId_idx" ON "CommunityRotationBoss"("rotationId");

CREATE UNIQUE INDEX "CommunityRotationLike_rotationId_userId_key" ON "CommunityRotationLike"("rotationId", "userId");
CREATE INDEX "CommunityRotationLike_userId_idx" ON "CommunityRotationLike"("userId");

CREATE UNIQUE INDEX "CommunityRotationFavorite_rotationId_userId_key" ON "CommunityRotationFavorite"("rotationId", "userId");
CREATE INDEX "CommunityRotationFavorite_userId_idx" ON "CommunityRotationFavorite"("userId");

CREATE INDEX "CommunityRotationComment_rotationId_idx" ON "CommunityRotationComment"("rotationId");
CREATE INDEX "CommunityRotationComment_userId_idx" ON "CommunityRotationComment"("userId");
CREATE INDEX "CommunityRotationComment_parentId_idx" ON "CommunityRotationComment"("parentId");
CREATE INDEX "CommunityRotationComment_createdAt_idx" ON "CommunityRotationComment"("createdAt");
CREATE INDEX "CommunityRotationComment_rotationId_parentId_createdAt_id_idx" ON "CommunityRotationComment"("rotationId", "parentId", "createdAt", "id");

CREATE UNIQUE INDEX "CommunityRotationCommentLike_commentId_userId_key" ON "CommunityRotationCommentLike"("commentId", "userId");
CREATE INDEX "CommunityRotationCommentLike_userId_idx" ON "CommunityRotationCommentLike"("userId");

CREATE INDEX "CommunityRotationTest_rotationId_createdAt_idx" ON "CommunityRotationTest"("rotationId", "createdAt");
CREATE INDEX "CommunityRotationTest_userId_idx" ON "CommunityRotationTest"("userId");

CREATE INDEX "CommunityRotation_status_createdAt_idx" ON "CommunityRotation"("status", "createdAt");
CREATE INDEX "CommunityRotation_status_recommendedLevel_huntMode_plannedDurationMinutes_idx" ON "CommunityRotation"("status", "recommendedLevel", "huntMode", "plannedDurationMinutes");
CREATE INDEX "CommunityRotation_userId_createdAt_idx" ON "CommunityRotation"("userId", "createdAt");

ALTER TABLE "CommunityRotation" ADD CONSTRAINT "CommunityRotation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityRotationBoss" ADD CONSTRAINT "CommunityRotationBoss_rotationId_fkey" FOREIGN KEY ("rotationId") REFERENCES "CommunityRotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityRotationBoss" ADD CONSTRAINT "CommunityRotationBoss_bossId_fkey" FOREIGN KEY ("bossId") REFERENCES "BosstiaryBoss"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommunityRotationLike" ADD CONSTRAINT "CommunityRotationLike_rotationId_fkey" FOREIGN KEY ("rotationId") REFERENCES "CommunityRotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityRotationLike" ADD CONSTRAINT "CommunityRotationLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityRotationFavorite" ADD CONSTRAINT "CommunityRotationFavorite_rotationId_fkey" FOREIGN KEY ("rotationId") REFERENCES "CommunityRotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityRotationFavorite" ADD CONSTRAINT "CommunityRotationFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityRotationComment" ADD CONSTRAINT "CommunityRotationComment_rotationId_fkey" FOREIGN KEY ("rotationId") REFERENCES "CommunityRotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityRotationComment" ADD CONSTRAINT "CommunityRotationComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityRotationComment" ADD CONSTRAINT "CommunityRotationComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CommunityRotationComment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CommunityRotationCommentLike" ADD CONSTRAINT "CommunityRotationCommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "CommunityRotationComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityRotationCommentLike" ADD CONSTRAINT "CommunityRotationCommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityRotationTest" ADD CONSTRAINT "CommunityRotationTest_rotationId_fkey" FOREIGN KEY ("rotationId") REFERENCES "CommunityRotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityRotationTest" ADD CONSTRAINT "CommunityRotationTest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
