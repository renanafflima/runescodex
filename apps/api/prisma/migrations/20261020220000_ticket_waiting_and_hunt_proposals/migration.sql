-- Waiting statuses are additive. Existing OPEN, IN_REVIEW, RESOLVED and REJECTED rows stay as they are.
-- Structured hunt proposals are nullable, so free-text requests already stored remain valid.

ALTER TYPE "TicketStatus" ADD VALUE 'WAITING_ON_USER';
ALTER TYPE "TicketStatus" ADD VALUE 'WAITING_ON_STAFF';

ALTER TABLE "HuntUpdateRequest" ADD COLUMN "currentValue" TEXT;
ALTER TABLE "HuntUpdateRequest" ADD COLUMN "proposedValue" TEXT;
ALTER TABLE "HuntUpdateRequest" ADD COLUMN "vocation" "Vocation";
ALTER TABLE "HuntUpdateRequest" ADD COLUMN "ticketId" TEXT;
ALTER TABLE "HuntUpdateRequest" ADD COLUMN "decidedByUserId" TEXT;
ALTER TABLE "HuntUpdateRequest" ADD COLUMN "appliedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "HuntUpdateRequest_ticketId_key" ON "HuntUpdateRequest"("ticketId");
CREATE INDEX "HuntUpdateRequest_decidedByUserId_idx" ON "HuntUpdateRequest"("decidedByUserId");

ALTER TABLE "HuntUpdateRequest"
ADD CONSTRAINT "HuntUpdateRequest_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HuntUpdateRequest"
ADD CONSTRAINT "HuntUpdateRequest_decidedByUserId_fkey"
FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
