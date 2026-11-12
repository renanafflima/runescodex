-- Link CommunityRotation to Party sharing without changing existing public rows.
-- Existing rotations stay PUBLIC (community feed). PRIVATE and GROUP are opt-in on create.

ALTER TABLE "CommunityRotation" ADD COLUMN "visibility" "BosstiaryVisibility" NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE "CommunityRotation" ADD COLUMN "partyId" TEXT;

CREATE INDEX "CommunityRotation_visibility_status_createdAt_idx" ON "CommunityRotation"("visibility", "status", "createdAt");
CREATE INDEX "CommunityRotation_partyId_visibility_status_idx" ON "CommunityRotation"("partyId", "visibility", "status");

ALTER TABLE "CommunityRotation" ADD CONSTRAINT "CommunityRotation_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
