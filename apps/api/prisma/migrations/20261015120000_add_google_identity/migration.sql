-- Google-only accounts have no password. Existing password accounts keep their hash.
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Stable Google subject. Null stays allowed for password accounts, and uniqueness ignores those nulls.
ALTER TABLE "User" ADD COLUMN "googleSub" TEXT;

CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");
