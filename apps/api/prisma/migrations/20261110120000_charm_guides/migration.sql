-- CreateEnum
CREATE TYPE "CharmGuideStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'CHANGES_REQUESTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CharmGuideCpCategory" AS ENUM ('CP_100', 'CP_200', 'CP_300', 'CP_500');

-- CreateEnum
CREATE TYPE "CharmGuideDifficulty" AS ENUM ('EASY', 'MEDIUM', 'ADVANCED', 'CHALLENGING');

-- AlterEnum
ALTER TYPE "TicketProblemType" ADD VALUE 'CHARM_GUIDE';

-- CreateTable
CREATE TABLE "CharmGuide" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "coverImage" TEXT,
    "cpCategory" "CharmGuideCpCategory" NOT NULL,
    "difficulty" "CharmGuideDifficulty" NOT NULL,
    "status" "CharmGuideStatus" NOT NULL DEFAULT 'DRAFT',
    "totalCharmPoints" INTEGER NOT NULL DEFAULT 0,
    "uniqueCreatureCount" INTEGER NOT NULL DEFAULT 0,
    "stepCount" INTEGER NOT NULL DEFAULT 0,
    "adminResponse" TEXT,
    "moderatedByUserId" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharmGuide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharmGuideStep" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "huntId" TEXT,
    "title" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharmGuideStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharmGuideStepCreature" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "creatureId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "CharmGuideStepCreature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharmGuideLike" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharmGuideLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharmGuideFavorite" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharmGuideFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharmGuideComment" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "content" TEXT NOT NULL,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharmGuideComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharmGuideCommentLike" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharmGuideCommentLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharmGuideCreatureProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "creatureId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharmGuideCreatureProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharmGuidePublishIdempotency" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "guideId" TEXT,
    "ticketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharmGuidePublishIdempotency_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "charmGuideId" TEXT;

-- CreateIndex
CREATE INDEX "CharmGuide_status_createdAt_idx" ON "CharmGuide"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CharmGuide_status_cpCategory_createdAt_idx" ON "CharmGuide"("status", "cpCategory", "createdAt");

-- CreateIndex
CREATE INDEX "CharmGuide_userId_createdAt_idx" ON "CharmGuide"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CharmGuide_cpCategory_status_idx" ON "CharmGuide"("cpCategory", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CharmGuideStep_guideId_position_key" ON "CharmGuideStep"("guideId", "position");

-- CreateIndex
CREATE INDEX "CharmGuideStep_guideId_idx" ON "CharmGuideStep"("guideId");

-- CreateIndex
CREATE INDEX "CharmGuideStep_huntId_idx" ON "CharmGuideStep"("huntId");

-- CreateIndex
CREATE UNIQUE INDEX "CharmGuideStepCreature_stepId_creatureId_key" ON "CharmGuideStepCreature"("stepId", "creatureId");

-- CreateIndex
CREATE UNIQUE INDEX "CharmGuideStepCreature_stepId_position_key" ON "CharmGuideStepCreature"("stepId", "position");

-- CreateIndex
CREATE INDEX "CharmGuideStepCreature_creatureId_idx" ON "CharmGuideStepCreature"("creatureId");

-- CreateIndex
CREATE UNIQUE INDEX "CharmGuideLike_guideId_userId_key" ON "CharmGuideLike"("guideId", "userId");

-- CreateIndex
CREATE INDEX "CharmGuideLike_userId_idx" ON "CharmGuideLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CharmGuideFavorite_guideId_userId_key" ON "CharmGuideFavorite"("guideId", "userId");

-- CreateIndex
CREATE INDEX "CharmGuideFavorite_userId_idx" ON "CharmGuideFavorite"("userId");

-- CreateIndex
CREATE INDEX "CharmGuideComment_guideId_parentId_createdAt_id_idx" ON "CharmGuideComment"("guideId", "parentId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "CharmGuideComment_userId_idx" ON "CharmGuideComment"("userId");

-- CreateIndex
CREATE INDEX "CharmGuideComment_parentId_idx" ON "CharmGuideComment"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "CharmGuideCommentLike_commentId_userId_key" ON "CharmGuideCommentLike"("commentId", "userId");

-- CreateIndex
CREATE INDEX "CharmGuideCommentLike_userId_idx" ON "CharmGuideCommentLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CharmGuideCreatureProgress_characterId_guideId_creatureId_key" ON "CharmGuideCreatureProgress"("characterId", "guideId", "creatureId");

-- CreateIndex
CREATE INDEX "CharmGuideCreatureProgress_guideId_characterId_idx" ON "CharmGuideCreatureProgress"("guideId", "characterId");

-- CreateIndex
CREATE INDEX "CharmGuideCreatureProgress_userId_idx" ON "CharmGuideCreatureProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CharmGuidePublishIdempotency_guideId_key" ON "CharmGuidePublishIdempotency"("guideId");

-- CreateIndex
CREATE UNIQUE INDEX "CharmGuidePublishIdempotency_userId_idempotencyKey_key" ON "CharmGuidePublishIdempotency"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "CharmGuidePublishIdempotency_createdAt_idx" ON "CharmGuidePublishIdempotency"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_charmGuideId_key" ON "Ticket"("charmGuideId");

-- CreateIndex
CREATE INDEX "Ticket_charmGuideId_idx" ON "Ticket"("charmGuideId");

-- AddForeignKey
ALTER TABLE "CharmGuide" ADD CONSTRAINT "CharmGuide_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharmGuide" ADD CONSTRAINT "CharmGuide_moderatedByUserId_fkey" FOREIGN KEY ("moderatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharmGuideStep" ADD CONSTRAINT "CharmGuideStep_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "CharmGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharmGuideStep" ADD CONSTRAINT "CharmGuideStep_huntId_fkey" FOREIGN KEY ("huntId") REFERENCES "Hunt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharmGuideStepCreature" ADD CONSTRAINT "CharmGuideStepCreature_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "CharmGuideStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharmGuideStepCreature" ADD CONSTRAINT "CharmGuideStepCreature_creatureId_fkey" FOREIGN KEY ("creatureId") REFERENCES "Creature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharmGuideLike" ADD CONSTRAINT "CharmGuideLike_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "CharmGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharmGuideLike" ADD CONSTRAINT "CharmGuideLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharmGuideFavorite" ADD CONSTRAINT "CharmGuideFavorite_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "CharmGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharmGuideFavorite" ADD CONSTRAINT "CharmGuideFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharmGuideComment" ADD CONSTRAINT "CharmGuideComment_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "CharmGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharmGuideComment" ADD CONSTRAINT "CharmGuideComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharmGuideComment" ADD CONSTRAINT "CharmGuideComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CharmGuideComment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharmGuideCommentLike" ADD CONSTRAINT "CharmGuideCommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "CharmGuideComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharmGuideCommentLike" ADD CONSTRAINT "CharmGuideCommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharmGuideCreatureProgress" ADD CONSTRAINT "CharmGuideCreatureProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharmGuideCreatureProgress" ADD CONSTRAINT "CharmGuideCreatureProgress_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharmGuideCreatureProgress" ADD CONSTRAINT "CharmGuideCreatureProgress_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "CharmGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharmGuideCreatureProgress" ADD CONSTRAINT "CharmGuideCreatureProgress_creatureId_fkey" FOREIGN KEY ("creatureId") REFERENCES "Creature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharmGuidePublishIdempotency" ADD CONSTRAINT "CharmGuidePublishIdempotency_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharmGuidePublishIdempotency" ADD CONSTRAINT "CharmGuidePublishIdempotency_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "CharmGuide"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_charmGuideId_fkey" FOREIGN KEY ("charmGuideId") REFERENCES "CharmGuide"("id") ON DELETE SET NULL ON UPDATE CASCADE;
