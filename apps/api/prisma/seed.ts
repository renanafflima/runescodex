/**
 * Catalog seed for Creature / Hunt / Bestiary foundation.
 *
 * Do NOT run this against production until the migration has been applied
 * manually. This file is not executed by migrate generate or prisma generate.
 *
 * Usage (after migrate deploy):
 *   npm run prisma:seed
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import {
  BESTIARY_ENTRIES,
  CREATURE_ELEMENTS,
  CREATURE_LOCATIONS,
  CREATURE_TOGETHER,
  CREATURES,
  HUNTS,
} from "./seed/catalog.js";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Apply the migration first, then run npm run prisma:seed.",
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const creatureIds = new Map<string, string>();

    for (const creature of CREATURES) {
      const row = await prisma.creature.upsert({
        where: { slug: creature.slug },
        update: {
          name: creature.name,
          image: creature.image,
          hp: "hp" in creature ? creature.hp : null,
          difficulty: "difficulty" in creature ? creature.difficulty : null,
          youtubeUrl: "youtubeUrl" in creature ? creature.youtubeUrl : null,
          isActive: true,
        },
        create: {
          slug: creature.slug,
          name: creature.name,
          image: creature.image,
          hp: "hp" in creature ? creature.hp : null,
          difficulty: "difficulty" in creature ? creature.difficulty : null,
          youtubeUrl: "youtubeUrl" in creature ? creature.youtubeUrl : null,
        },
      });
      creatureIds.set(creature.slug, row.id);
    }

    for (const element of CREATURE_ELEMENTS) {
      const creatureId = requireCreature(creatureIds, element.creatureSlug);
      await prisma.creatureElement.upsert({
        where: {
          creatureId_element: { creatureId, element: element.element },
        },
        update: { modifier: element.modifier },
        create: {
          creatureId,
          element: element.element,
          modifier: element.modifier,
        },
      });
    }

    for (const location of CREATURE_LOCATIONS) {
      const creatureId = requireCreature(creatureIds, location.creatureSlug);
      await prisma.creatureLocation.upsert({
        where: {
          creatureId_name: { creatureId, name: location.name },
        },
        update: { region: location.region },
        create: {
          creatureId,
          name: location.name,
          region: location.region,
        },
      });
    }

    for (const pair of CREATURE_TOGETHER) {
      const creatureId = requireCreature(creatureIds, pair.creatureSlug);
      const relatedCreatureId = requireCreature(creatureIds, pair.relatedSlug);
      await prisma.creatureTogether.upsert({
        where: {
          creatureId_relatedCreatureId: { creatureId, relatedCreatureId },
        },
        update: {},
        create: { creatureId, relatedCreatureId },
      });
    }

    for (const entry of BESTIARY_ENTRIES) {
      const creatureId = requireCreature(creatureIds, entry.creatureSlug);
      await prisma.bestiaryEntry.upsert({
        where: { creatureId },
        update: {
          category: entry.category,
          killsRequired: entry.killsRequired,
          estimatedKillsPerHour: entry.estimatedKillsPerHour,
        },
        create: {
          creatureId,
          category: entry.category,
          killsRequired: entry.killsRequired,
          estimatedKillsPerHour: entry.estimatedKillsPerHour,
        },
      });
    }

    for (const hunt of HUNTS) {
      const row = await prisma.hunt.upsert({
        where: { slug: hunt.slug },
        update: {
          name: hunt.name,
          location: hunt.location,
          subLocation: hunt.subLocation,
          difficulty: hunt.difficulty,
          mapImage: hunt.mapImage,
          heroImage: null,
          isActive: true,
        },
        create: {
          slug: hunt.slug,
          name: hunt.name,
          location: hunt.location,
          subLocation: hunt.subLocation,
          difficulty: hunt.difficulty,
          mapImage: hunt.mapImage,
        },
      });

      for (const vocation of hunt.vocations) {
        await prisma.huntVocation.upsert({
          where: {
            huntId_vocation: { huntId: row.id, vocation: vocation.vocation },
          },
          update: {
            isRecommended: vocation.isRecommended,
            levelMin: vocation.levelMin,
            xpPerHour: vocation.xpPerHour,
            profitPerHour: vocation.profitPerHour,
            notes: vocation.notes,
          },
          create: {
            huntId: row.id,
            vocation: vocation.vocation,
            isRecommended: vocation.isRecommended,
            levelMin: vocation.levelMin,
            xpPerHour: vocation.xpPerHour,
            profitPerHour: vocation.profitPerHour,
            notes: vocation.notes,
          },
        });
      }

      for (const appearance of hunt.creatures) {
        const creatureId = requireCreature(creatureIds, appearance.creatureSlug);
        const recommendedCharm =
          "recommendedCharm" in appearance ? appearance.recommendedCharm : null;
        await prisma.huntCreature.upsert({
          where: {
            huntId_creatureId: { huntId: row.id, creatureId },
          },
          update: {
            isPrimary: appearance.isPrimary,
            recommendedCharm,
          },
          create: {
            huntId: row.id,
            creatureId,
            isPrimary: appearance.isPrimary,
            recommendedCharm,
          },
        });
      }

      for (const item of hunt.loot) {
        const existing = await prisma.huntLoot.findFirst({
          where: { huntId: row.id, itemName: item.itemName },
        });
        if (existing) {
          await prisma.huntLoot.update({
            where: { id: existing.id },
            data: {
              itemImage: item.itemImage ?? null,
              estimatedValue: item.estimatedValue ?? null,
              importance: item.importance ?? null,
            },
          });
        } else {
          await prisma.huntLoot.create({
            data: {
              huntId: row.id,
              itemName: item.itemName,
              itemImage: item.itemImage ?? null,
              estimatedValue: item.estimatedValue ?? null,
              importance: item.importance ?? null,
            },
          });
        }
      }

      for (const video of hunt.videos) {
        const existing = await prisma.huntVideo.findFirst({
          where: { huntId: row.id, url: video.url },
        });
        if (existing) {
          await prisma.huntVideo.update({
            where: { id: existing.id },
            data: {
              title: video.title,
              isRecommended: video.isRecommended,
            },
          });
        } else {
          await prisma.huntVideo.create({
            data: {
              huntId: row.id,
              title: video.title,
              url: video.url,
              isRecommended: video.isRecommended,
            },
          });
        }
      }
    }

    console.log(
      `Seeded ${CREATURES.length} creatures, ${HUNTS.length} hunts, ${BESTIARY_ENTRIES.length} bestiary entries.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

function requireCreature(ids: Map<string, string>, slug: string): string {
  const id = ids.get(slug);
  if (!id) {
    throw new Error(`Creature slug not seeded: ${slug}`);
  }
  return id;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
