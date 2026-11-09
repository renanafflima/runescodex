-- One evaluation ("Funcionou pra mim") per user and rotation.
DELETE FROM "CommunityRotationTest" AS newer
USING "CommunityRotationTest" AS older
WHERE newer."rotationId" = older."rotationId"
  AND newer."userId" = older."userId"
  AND (
    newer."createdAt" > older."createdAt"
    OR (newer."createdAt" = older."createdAt" AND newer."id" > older."id")
  );

CREATE UNIQUE INDEX "CommunityRotationTest_rotationId_userId_key"
ON "CommunityRotationTest"("rotationId", "userId");
