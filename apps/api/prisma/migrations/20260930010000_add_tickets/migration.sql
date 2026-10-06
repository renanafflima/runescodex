-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TicketProblemType" AS ENUM ('XP_PER_HOUR', 'PROFIT', 'HUNT_OUTDATED', 'BESTIARY', 'DIFFICULTY', 'INCORRECT_INFO', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketImpact" AS ENUM ('INCORRECT_INFO', 'LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TicketOrigin" AS ENUM ('HUNT', 'BESTIARY', 'GENERAL');

-- CreateEnum
CREATE TYPE "TicketPartyFormat" AS ENUM ('SOLO', 'PT_2', 'PT_3', 'PT_4', 'PT_5_PLUS');

-- CreateEnum
CREATE TYPE "TicketVocation" AS ENUM ('EK', 'MS', 'ED', 'RP', 'MONK');

-- CreateEnum
CREATE TYPE "TicketEvidenceSource" AS ENUM ('CAMERA', 'DEVICE');

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "problemType" "TicketProblemType" NOT NULL,
    "impact" "TicketImpact" NOT NULL,
    "origin" "TicketOrigin" NOT NULL,
    "description" TEXT NOT NULL,
    "huntId" TEXT,
    "creatureId" TEXT,
    "playerLevel" INTEGER,
    "partyFormat" "TicketPartyFormat",
    "catalogValue" TEXT,
    "userValue" TEXT,
    "resolutionNote" TEXT,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "rewardPoints" INTEGER,
    "rewardGrantedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketVocationSelection" (
    "ticketId" TEXT NOT NULL,
    "vocation" "TicketVocation" NOT NULL,

    CONSTRAINT "TicketVocationSelection_pkey" PRIMARY KEY ("ticketId","vocation")
);

-- CreateTable
CREATE TABLE "TicketEvidence" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT,
    "mimeType" TEXT NOT NULL,
    "source" "TicketEvidenceSource" NOT NULL,
    "byteSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ticket_authorId_createdAt_idx" ON "Ticket"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_status_createdAt_idx" ON "Ticket"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_huntId_idx" ON "Ticket"("huntId");

-- CreateIndex
CREATE INDEX "Ticket_creatureId_idx" ON "Ticket"("creatureId");

-- CreateIndex
CREATE INDEX "TicketEvidence_ticketId_idx" ON "TicketEvidence"("ticketId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_huntId_fkey" FOREIGN KEY ("huntId") REFERENCES "Hunt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_creatureId_fkey" FOREIGN KEY ("creatureId") REFERENCES "Creature"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketVocationSelection" ADD CONSTRAINT "TicketVocationSelection_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEvidence" ADD CONSTRAINT "TicketEvidence_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
