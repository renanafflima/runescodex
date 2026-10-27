-- Linked browser installations. Existing AuthSession rows keep a null deviceId
-- and remain valid until they expire or the user logs out.

CREATE TYPE "AuthDeviceStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "AuthDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "publicKeyHash" TEXT NOT NULL,
    "publicKeySpki" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "deviceType" TEXT,
    "osName" TEXT,
    "clientName" TEXT,
    "status" "AuthDeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "slot" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AuthDevice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AuthDevice_slot_range" CHECK ("slot" IS NULL OR "slot" IN (1, 2)),
    CONSTRAINT "AuthDevice_active_slot" CHECK ("status" <> 'ACTIVE' OR "slot" IS NOT NULL)
);

CREATE UNIQUE INDEX "AuthDevice_userId_installationId_key" ON "AuthDevice"("userId", "installationId");
CREATE INDEX "AuthDevice_userId_status_idx" ON "AuthDevice"("userId", "status");
CREATE UNIQUE INDEX "AuthDevice_user_active_slot_key" ON "AuthDevice"("userId", "slot") WHERE "status" = 'ACTIVE';

ALTER TABLE "AuthDevice" ADD CONSTRAINT "AuthDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AuthDeviceChallenge" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "publicKeyHash" TEXT NOT NULL,
    "publicKeySpki" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthDeviceChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthDeviceChallenge_nonce_key" ON "AuthDeviceChallenge"("nonce");
CREATE INDEX "AuthDeviceChallenge_expiresAt_idx" ON "AuthDeviceChallenge"("expiresAt");

ALTER TABLE "AuthSession" ADD COLUMN "deviceId" TEXT;
CREATE INDEX "AuthSession_deviceId_idx" ON "AuthSession"("deviceId");
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "AuthDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
