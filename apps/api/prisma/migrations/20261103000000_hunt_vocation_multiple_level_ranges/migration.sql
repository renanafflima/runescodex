-- AlterTable
-- Allow a vocation to have more than one level range per hunt (e.g. ED
-- 270-399 and ED 400-600 in the same hunt, each with its own xpPerHour /
-- profitPerHour). Drops the old 1-row-per-(hunt,vocation) uniqueness; no
-- rows are modified or deleted, and a plain (non-unique) index keeps the
-- huntId+vocation lookup fast for existing queries.
DROP INDEX "HuntVocation_huntId_vocation_key";

-- CreateIndex
CREATE INDEX "HuntVocation_huntId_vocation_idx" ON "HuntVocation"("huntId", "vocation");
