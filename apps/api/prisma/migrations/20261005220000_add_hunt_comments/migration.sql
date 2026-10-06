-- CreateTable
CREATE TABLE "HuntComment" (
    "id" TEXT NOT NULL,
    "huntId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "content" TEXT NOT NULL,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HuntComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HuntCommentLike" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HuntCommentLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HuntComment_huntId_idx" ON "HuntComment"("huntId");

-- CreateIndex
CREATE INDEX "HuntComment_userId_idx" ON "HuntComment"("userId");

-- CreateIndex
CREATE INDEX "HuntComment_parentId_idx" ON "HuntComment"("parentId");

-- CreateIndex
CREATE INDEX "HuntComment_createdAt_idx" ON "HuntComment"("createdAt");

-- CreateIndex
CREATE INDEX "HuntComment_huntId_parentId_createdAt_id_idx" ON "HuntComment"("huntId", "parentId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "HuntCommentLike_commentId_userId_key" ON "HuntCommentLike"("commentId", "userId");

-- CreateIndex
CREATE INDEX "HuntCommentLike_userId_idx" ON "HuntCommentLike"("userId");

-- AddForeignKey
ALTER TABLE "HuntComment" ADD CONSTRAINT "HuntComment_huntId_fkey" FOREIGN KEY ("huntId") REFERENCES "Hunt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuntComment" ADD CONSTRAINT "HuntComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuntComment" ADD CONSTRAINT "HuntComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "HuntComment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuntCommentLike" ADD CONSTRAINT "HuntCommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "HuntComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuntCommentLike" ADD CONSTRAINT "HuntCommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
