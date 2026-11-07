-- Idempotent community rotation publish (per user + Idempotency-Key header).

CREATE TABLE "CommunityRotationPublishIdempotency" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "rotationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityRotationPublishIdempotency_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CommunityRotationPublishIdempotency_idempotency_key_not_empty" CHECK (length(btrim("idempotencyKey")) > 0),
    CONSTRAINT "CommunityRotationPublishIdempotency_request_hash_not_empty" CHECK (length(btrim("requestHash")) > 0)
);

CREATE UNIQUE INDEX "CommunityRotationPublishIdempotency_userId_idempotencyKey_key"
ON "CommunityRotationPublishIdempotency"("userId", "idempotencyKey");

CREATE UNIQUE INDEX "CommunityRotationPublishIdempotency_rotationId_key"
ON "CommunityRotationPublishIdempotency"("rotationId");

CREATE INDEX "CommunityRotationPublishIdempotency_userId_createdAt_idx"
ON "CommunityRotationPublishIdempotency"("userId", "createdAt");

ALTER TABLE "CommunityRotationPublishIdempotency" ADD CONSTRAINT "CommunityRotationPublishIdempotency_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityRotationPublishIdempotency" ADD CONSTRAINT "CommunityRotationPublishIdempotency_rotationId_fkey"
FOREIGN KEY ("rotationId") REFERENCES "CommunityRotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
