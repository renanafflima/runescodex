-- Party groups, email invitations, hunt sessions and in-app notifications.
-- Personal progress rows keep their owner; GROUP visibility is enforced in the API.

CREATE TYPE "PartyStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "PartyMemberRole" AS ENUM ('LEADER', 'OFFICER', 'MEMBER');
CREATE TYPE "PartyMemberStatus" AS ENUM ('ACTIVE', 'LEFT', 'REMOVED');
CREATE TYPE "PartyInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "HuntSessionStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "HuntSessionParticipantStatus" AS ENUM ('INVITED', 'CONFIRMED', 'LEFT');
CREATE TYPE "AppNotificationKind" AS ENUM (
  'PARTY_INVITE_RECEIVED',
  'PARTY_INVITE_ACCEPTED',
  'PARTY_INVITE_DECLINED',
  'PARTY_MEMBER_ADDED',
  'PARTY_MEMBER_REMOVED',
  'HUNT_SESSION_CREATED',
  'HUNT_SESSION_INVITED',
  'HUNT_SESSION_STARTED',
  'HUNT_SESSION_COMPLETED'
);

CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "status" "PartyStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Party_name_not_empty" CHECK (length(btrim("name")) > 0)
);

CREATE TABLE "PartyMember" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "PartyMemberRole" NOT NULL DEFAULT 'MEMBER',
    "status" "PartyMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartyInvitation" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "inviteeUserId" TEXT,
    "status" "PartyInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyInvitation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PartyInvitation_email_not_empty" CHECK (length(btrim("emailNormalized")) > 3)
);

CREATE TABLE "HuntSession" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "rotationId" TEXT,
    "rotationTitle" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "plannedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" "HuntSessionStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HuntSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HuntSession_title_not_empty" CHECK (length(btrim("title")) > 0)
);

CREATE TABLE "HuntSessionParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "HuntSessionParticipantStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HuntSessionParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "AppNotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "partyId" TEXT,
    "sessionId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppNotification_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BosstiaryProgressActivity"
ADD COLUMN "partyId" TEXT;

CREATE INDEX "Party_createdById_createdAt_idx" ON "Party"("createdById", "createdAt");
CREATE INDEX "Party_status_createdAt_idx" ON "Party"("status", "createdAt");

CREATE UNIQUE INDEX "PartyMember_partyId_userId_key" ON "PartyMember"("partyId", "userId");
CREATE INDEX "PartyMember_userId_status_idx" ON "PartyMember"("userId", "status");
CREATE INDEX "PartyMember_partyId_status_idx" ON "PartyMember"("partyId", "status");

CREATE UNIQUE INDEX "PartyInvitation_party_email_pending_key"
ON "PartyInvitation"("partyId", "emailNormalized")
WHERE "status" = 'PENDING';
CREATE INDEX "PartyInvitation_inviteeUserId_status_createdAt_idx"
ON "PartyInvitation"("inviteeUserId", "status", "createdAt");
CREATE INDEX "PartyInvitation_emailNormalized_status_idx"
ON "PartyInvitation"("emailNormalized", "status");
CREATE INDEX "PartyInvitation_partyId_status_createdAt_idx"
ON "PartyInvitation"("partyId", "status", "createdAt");
CREATE INDEX "PartyInvitation_inviterId_createdAt_idx"
ON "PartyInvitation"("inviterId", "createdAt");

CREATE INDEX "HuntSession_partyId_createdAt_idx" ON "HuntSession"("partyId", "createdAt");
CREATE INDEX "HuntSession_partyId_status_idx" ON "HuntSession"("partyId", "status");
CREATE INDEX "HuntSession_rotationId_idx" ON "HuntSession"("rotationId");

CREATE UNIQUE INDEX "HuntSessionParticipant_sessionId_userId_key"
ON "HuntSessionParticipant"("sessionId", "userId");
CREATE INDEX "HuntSessionParticipant_userId_status_idx"
ON "HuntSessionParticipant"("userId", "status");

CREATE INDEX "AppNotification_userId_createdAt_idx" ON "AppNotification"("userId", "createdAt");
CREATE INDEX "AppNotification_userId_readAt_idx" ON "AppNotification"("userId", "readAt");

CREATE INDEX "BosstiaryProgressActivity_partyId_visibility_occurredAt_idx"
ON "BosstiaryProgressActivity"("partyId", "visibility", "occurredAt");
CREATE INDEX "BosstiaryProgressActivity_partySessionId_occurredAt_idx"
ON "BosstiaryProgressActivity"("partySessionId", "occurredAt");

ALTER TABLE "Party"
ADD CONSTRAINT "Party_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PartyMember"
ADD CONSTRAINT "PartyMember_partyId_fkey"
FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PartyMember"
ADD CONSTRAINT "PartyMember_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PartyInvitation"
ADD CONSTRAINT "PartyInvitation_partyId_fkey"
FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PartyInvitation"
ADD CONSTRAINT "PartyInvitation_inviterId_fkey"
FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PartyInvitation"
ADD CONSTRAINT "PartyInvitation_inviteeUserId_fkey"
FOREIGN KEY ("inviteeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HuntSession"
ADD CONSTRAINT "HuntSession_partyId_fkey"
FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HuntSession"
ADD CONSTRAINT "HuntSession_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HuntSession"
ADD CONSTRAINT "HuntSession_rotationId_fkey"
FOREIGN KEY ("rotationId") REFERENCES "CommunityRotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HuntSessionParticipant"
ADD CONSTRAINT "HuntSessionParticipant_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "HuntSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HuntSessionParticipant"
ADD CONSTRAINT "HuntSessionParticipant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AppNotification"
ADD CONSTRAINT "AppNotification_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BosstiaryProgressActivity"
ADD CONSTRAINT "BosstiaryProgressActivity_partyId_fkey"
FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BosstiaryProgressActivity"
ADD CONSTRAINT "BosstiaryProgressActivity_partySessionId_fkey"
FOREIGN KEY ("partySessionId") REFERENCES "HuntSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
