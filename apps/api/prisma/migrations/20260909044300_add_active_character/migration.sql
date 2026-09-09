-- AlterTable
ALTER TABLE "User" ADD COLUMN "activeCharacterId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_activeCharacterId_key" ON "User"("activeCharacterId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activeCharacterId_fkey" FOREIGN KEY ("activeCharacterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;
