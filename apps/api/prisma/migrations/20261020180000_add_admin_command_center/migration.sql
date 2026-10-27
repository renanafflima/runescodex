-- Administrative operations: ticket workflow, audit, settings, and usage events.
-- Existing ticket rows receive a stable protocol before the column becomes required.

CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "TicketMessageVisibility" AS ENUM ('PUBLIC', 'INTERNAL');
CREATE TYPE "ContentSubject" AS ENUM ('HUNT', 'CREATURE', 'BOSS');

ALTER TABLE "Ticket" ADD COLUMN "protocol" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "Ticket" ADD COLUMN "urgentReason" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "assigneeId" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "firstResponseAt" TIMESTAMP(3);
ALTER TABLE "Ticket" ADD COLUMN "contentAppliedAt" TIMESTAMP(3);

UPDATE "Ticket"
SET "protocol" = 'RC-' || UPPER(SUBSTRING(REPLACE("id"::text, '-', ''), 1, 10))
WHERE "protocol" IS NULL;

ALTER TABLE "Ticket" ALTER COLUMN "protocol" SET NOT NULL;
CREATE UNIQUE INDEX "Ticket_protocol_key" ON "Ticket"("protocol");
CREATE INDEX "Ticket_assigneeId_status_createdAt_idx" ON "Ticket"("assigneeId", "status", "createdAt");
CREATE INDEX "Ticket_priority_createdAt_idx" ON "Ticket"("priority", "createdAt");

ALTER TABLE "Ticket"
ADD CONSTRAINT "Ticket_assigneeId_fkey"
FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "TicketMessage" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "visibility" "TicketMessageVisibility" NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");
CREATE INDEX "TicketMessage_authorId_idx" ON "TicketMessage"("authorId");

ALTER TABLE "TicketMessage"
ADD CONSTRAINT "TicketMessage_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TicketMessage"
ADD CONSTRAINT "TicketMessage_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AdminAuditEvent" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminAuditEvent_createdAt_idx" ON "AdminAuditEvent"("createdAt");
CREATE INDEX "AdminAuditEvent_actorUserId_createdAt_idx" ON "AdminAuditEvent"("actorUserId", "createdAt");
CREATE INDEX "AdminAuditEvent_entityType_entityId_createdAt_idx" ON "AdminAuditEvent"("entityType", "entityId", "createdAt");
CREATE INDEX "AdminAuditEvent_action_createdAt_idx" ON "AdminAuditEvent"("action", "createdAt");

ALTER TABLE "AdminAuditEvent"
ADD CONSTRAINT "AdminAuditEvent_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AdminSetting" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedByUserId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminSetting_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "AdminSetting"
ADD CONSTRAINT "AdminSetting_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ContentViewEvent" (
  "id" TEXT NOT NULL,
  "subject" "ContentSubject" NOT NULL,
  "subjectId" TEXT NOT NULL,
  "sessionKey" TEXT NOT NULL,
  "userId" TEXT,
  "bucketStart" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContentViewEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentViewEvent_sessionKey_subject_subjectId_bucketStart_key"
ON "ContentViewEvent"("sessionKey", "subject", "subjectId", "bucketStart");
CREATE INDEX "ContentViewEvent_subject_subjectId_createdAt_idx"
ON "ContentViewEvent"("subject", "subjectId", "createdAt");
CREATE INDEX "ContentViewEvent_createdAt_idx" ON "ContentViewEvent"("createdAt");
CREATE INDEX "ContentViewEvent_userId_createdAt_idx" ON "ContentViewEvent"("userId", "createdAt");

ALTER TABLE "ContentViewEvent"
ADD CONSTRAINT "ContentViewEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SearchMiss" (
  "id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "term" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SearchMiss_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SearchMiss_category_createdAt_idx" ON "SearchMiss"("category", "createdAt");
CREATE INDEX "SearchMiss_createdAt_idx" ON "SearchMiss"("createdAt");
