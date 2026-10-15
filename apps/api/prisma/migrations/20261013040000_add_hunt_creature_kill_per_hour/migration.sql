-- AlterTable
-- Nullable on purpose: existing HuntCreature rows stay unchanged.
ALTER TABLE "HuntCreature" ADD COLUMN "killPerHour" INTEGER;
