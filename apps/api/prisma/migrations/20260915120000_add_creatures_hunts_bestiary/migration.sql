-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD', 'VERY_HARD');

-- CreateEnum
CREATE TYPE "ElementType" AS ENUM ('PHYSICAL', 'FIRE', 'ICE', 'EARTH', 'ENERGY', 'HOLY', 'DEATH');

-- CreateEnum
CREATE TYPE "Vocation" AS ENUM ('EK', 'RP', 'ED', 'MS');

-- CreateEnum
CREATE TYPE "Charm" AS ENUM ('WOUND', 'POISON', 'ENFLAME', 'FREEZE', 'ZAP', 'CURSE', 'DIVINE_WRATH', 'OVERPOWER', 'OVERFLUX');

-- CreateTable
CREATE TABLE "Creature" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "hp" INTEGER,
    "experience" INTEGER,
    "difficulty" "Difficulty",
    "description" TEXT,
    "youtubeUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatureElement" (
    "id" TEXT NOT NULL,
    "creatureId" TEXT NOT NULL,
    "element" "ElementType" NOT NULL,
    "modifier" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatureElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatureLocation" (
    "id" TEXT NOT NULL,
    "creatureId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatureLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatureTogether" (
    "id" TEXT NOT NULL,
    "creatureId" TEXT NOT NULL,
    "relatedCreatureId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatureTogether_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hunt" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "subLocation" TEXT,
    "difficulty" "Difficulty" NOT NULL,
    "respawn" TEXT,
    "description" TEXT,
    "heroImage" TEXT,
    "mapImage" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hunt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HuntVocation" (
    "id" TEXT NOT NULL,
    "huntId" TEXT NOT NULL,
    "vocation" "Vocation" NOT NULL,
    "isRecommended" BOOLEAN NOT NULL DEFAULT false,
    "levelMin" INTEGER NOT NULL,
    "levelMax" INTEGER,
    "xpPerHour" INTEGER NOT NULL,
    "profitPerHour" INTEGER NOT NULL,
    "difficulty" "Difficulty",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HuntVocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HuntCreature" (
    "id" TEXT NOT NULL,
    "huntId" TEXT NOT NULL,
    "creatureId" TEXT NOT NULL,
    "damageType" "ElementType",
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "quantity" INTEGER,
    "recommendedCharm" "Charm",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HuntCreature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HuntLoot" (
    "id" TEXT NOT NULL,
    "huntId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemImage" TEXT,
    "estimatedValue" INTEGER,
    "importance" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HuntLoot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HuntVideo" (
    "id" TEXT NOT NULL,
    "huntId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "channel" TEXT,
    "isRecommended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HuntVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BestiaryEntry" (
    "id" TEXT NOT NULL,
    "creatureId" TEXT NOT NULL,
    "category" TEXT,
    "killsRequired" INTEGER NOT NULL,
    "estimatedKillsPerHour" INTEGER,
    "charmPoints" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BestiaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBestiaryProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creatureId" TEXT NOT NULL,
    "kills" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBestiaryProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Creature_slug_key" ON "Creature"("slug");

-- CreateIndex
CREATE INDEX "Creature_isActive_idx" ON "Creature"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CreatureElement_creatureId_element_key" ON "CreatureElement"("creatureId", "element");

-- CreateIndex
CREATE INDEX "CreatureElement_creatureId_idx" ON "CreatureElement"("creatureId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatureLocation_creatureId_name_key" ON "CreatureLocation"("creatureId", "name");

-- CreateIndex
CREATE INDEX "CreatureLocation_creatureId_idx" ON "CreatureLocation"("creatureId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatureTogether_creatureId_relatedCreatureId_key" ON "CreatureTogether"("creatureId", "relatedCreatureId");

-- CreateIndex
CREATE INDEX "CreatureTogether_creatureId_idx" ON "CreatureTogether"("creatureId");

-- CreateIndex
CREATE INDEX "CreatureTogether_relatedCreatureId_idx" ON "CreatureTogether"("relatedCreatureId");

-- CreateIndex
CREATE UNIQUE INDEX "Hunt_slug_key" ON "Hunt"("slug");

-- CreateIndex
CREATE INDEX "Hunt_isActive_idx" ON "Hunt"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "HuntVocation_huntId_vocation_key" ON "HuntVocation"("huntId", "vocation");

-- CreateIndex
CREATE INDEX "HuntVocation_huntId_idx" ON "HuntVocation"("huntId");

-- CreateIndex
CREATE INDEX "HuntVocation_vocation_idx" ON "HuntVocation"("vocation");

-- CreateIndex
CREATE UNIQUE INDEX "HuntCreature_huntId_creatureId_key" ON "HuntCreature"("huntId", "creatureId");

-- CreateIndex
CREATE UNIQUE INDEX "HuntCreature_huntId_recommendedCharm_key" ON "HuntCreature"("huntId", "recommendedCharm");

-- CreateIndex
CREATE INDEX "HuntCreature_huntId_idx" ON "HuntCreature"("huntId");

-- CreateIndex
CREATE INDEX "HuntCreature_creatureId_idx" ON "HuntCreature"("creatureId");

-- CreateIndex
CREATE INDEX "HuntLoot_huntId_idx" ON "HuntLoot"("huntId");

-- CreateIndex
CREATE INDEX "HuntVideo_huntId_idx" ON "HuntVideo"("huntId");

-- CreateIndex
CREATE UNIQUE INDEX "BestiaryEntry_creatureId_key" ON "BestiaryEntry"("creatureId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBestiaryProgress_userId_creatureId_key" ON "UserBestiaryProgress"("userId", "creatureId");

-- CreateIndex
CREATE INDEX "UserBestiaryProgress_userId_idx" ON "UserBestiaryProgress"("userId");

-- CreateIndex
CREATE INDEX "UserBestiaryProgress_creatureId_idx" ON "UserBestiaryProgress"("creatureId");

-- AddForeignKey
ALTER TABLE "CreatureElement" ADD CONSTRAINT "CreatureElement_creatureId_fkey" FOREIGN KEY ("creatureId") REFERENCES "Creature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatureLocation" ADD CONSTRAINT "CreatureLocation_creatureId_fkey" FOREIGN KEY ("creatureId") REFERENCES "Creature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatureTogether" ADD CONSTRAINT "CreatureTogether_creatureId_fkey" FOREIGN KEY ("creatureId") REFERENCES "Creature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatureTogether" ADD CONSTRAINT "CreatureTogether_relatedCreatureId_fkey" FOREIGN KEY ("relatedCreatureId") REFERENCES "Creature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheck
ALTER TABLE "CreatureTogether" ADD CONSTRAINT "CreatureTogether_no_self_check" CHECK ("creatureId" <> "relatedCreatureId");

-- AddForeignKey
ALTER TABLE "HuntVocation" ADD CONSTRAINT "HuntVocation_huntId_fkey" FOREIGN KEY ("huntId") REFERENCES "Hunt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuntCreature" ADD CONSTRAINT "HuntCreature_huntId_fkey" FOREIGN KEY ("huntId") REFERENCES "Hunt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuntCreature" ADD CONSTRAINT "HuntCreature_creatureId_fkey" FOREIGN KEY ("creatureId") REFERENCES "Creature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuntLoot" ADD CONSTRAINT "HuntLoot_huntId_fkey" FOREIGN KEY ("huntId") REFERENCES "Hunt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuntVideo" ADD CONSTRAINT "HuntVideo_huntId_fkey" FOREIGN KEY ("huntId") REFERENCES "Hunt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BestiaryEntry" ADD CONSTRAINT "BestiaryEntry_creatureId_fkey" FOREIGN KEY ("creatureId") REFERENCES "Creature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBestiaryProgress" ADD CONSTRAINT "UserBestiaryProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBestiaryProgress" ADD CONSTRAINT "UserBestiaryProgress_creatureId_fkey" FOREIGN KEY ("creatureId") REFERENCES "Creature"("id") ON DELETE CASCADE ON UPDATE CASCADE;
