-- CreateEnum
CREATE TYPE "HuntUpdateRequestStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "HuntUpdateRequestType" AS ENUM ('XP', 'PROFIT', 'LEVEL', 'VOCATION', 'CREATURES', 'LOCATION', 'LOOT', 'OTHER');

-- CreateTable
CREATE TABLE "HuntUpdateRequest" (
    "id" TEXT NOT NULL,
    "huntId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "HuntUpdateRequestType" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "HuntUpdateRequestStatus" NOT NULL DEFAULT 'OPEN',
    "adminResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "HuntUpdateRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HuntUpdateRequest_huntId_idx" ON "HuntUpdateRequest"("huntId");

-- CreateIndex
CREATE INDEX "HuntUpdateRequest_userId_idx" ON "HuntUpdateRequest"("userId");

-- CreateIndex
CREATE INDEX "HuntUpdateRequest_status_idx" ON "HuntUpdateRequest"("status");

-- CreateIndex
CREATE INDEX "HuntUpdateRequest_createdAt_idx" ON "HuntUpdateRequest"("createdAt");

-- CreateIndex
CREATE INDEX "HuntUpdateRequest_huntId_userId_createdAt_idx" ON "HuntUpdateRequest"("huntId", "userId", "createdAt");

-- AddForeignKey
ALTER TABLE "HuntUpdateRequest" ADD CONSTRAINT "HuntUpdateRequest_huntId_fkey" FOREIGN KEY ("huntId") REFERENCES "Hunt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuntUpdateRequest" ADD CONSTRAINT "HuntUpdateRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
