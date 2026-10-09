-- CreateEnum
CREATE TYPE "ForumCategory" AS ENUM ('BESTIARY', 'HUNTS', 'PROFIT', 'XP', 'TIPS');

-- AlterTable
ALTER TABLE "ForumThread" ADD COLUMN "category" "ForumCategory";

-- CreateIndex
CREATE INDEX "ForumThread_category_idx" ON "ForumThread"("category");

-- CreateIndex
CREATE INDEX "ForumThread_category_createdAt_id_idx" ON "ForumThread"("category", "createdAt", "id");
