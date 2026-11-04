-- AlterTable
-- Identifies which HuntVocation level range a structured update request targets.
ALTER TABLE "HuntUpdateRequest" ADD COLUMN "rangeLevelMin" INTEGER,
ADD COLUMN "rangeLevelMax" INTEGER;
