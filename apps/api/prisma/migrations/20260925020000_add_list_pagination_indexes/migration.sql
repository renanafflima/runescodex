-- List queries page by active name, difficulty, forum chronology, and vocation level.
-- location uses case-insensitive contains (ILIKE '%term%'). A btree index cannot
-- serve a leading wildcard, so the filter uses a trigram GIN index.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Creature_name_idx" ON "Creature"("name");
CREATE INDEX "Creature_isActive_name_idx" ON "Creature"("isActive", "name");
CREATE INDEX "Creature_isActive_difficulty_name_idx" ON "Creature"("isActive", "difficulty", "name");

CREATE INDEX "Hunt_name_idx" ON "Hunt"("name");
CREATE INDEX "Hunt_isActive_name_idx" ON "Hunt"("isActive", "name");
CREATE INDEX "Hunt_isActive_difficulty_name_idx" ON "Hunt"("isActive", "difficulty", "name");
CREATE INDEX "Hunt_location_trgm_idx" ON "Hunt" USING gin ("location" gin_trgm_ops);

CREATE INDEX "HuntVocation_vocation_levelMin_idx" ON "HuntVocation"("vocation", "levelMin");

CREATE INDEX "ForumThread_status_createdAt_id_idx" ON "ForumThread"("status", "createdAt", "id");
CREATE INDEX "ForumThread_createdAt_id_idx" ON "ForumThread"("createdAt", "id");

CREATE INDEX "ForumReply_threadId_createdAt_id_idx" ON "ForumReply"("threadId", "createdAt", "id");
