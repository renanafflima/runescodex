/**
 * Seeds only Rewards missions/catalog. Does not touch hunts, users, or other tables.
 *
 * Usage:
 *   npx tsx prisma/seed-rewards-run.ts
 */
import "dotenv/config";
import { assertRuntimeEnvironment } from "../src/common/database-target.js";
import { publicErrorText } from "../src/common/redact-error.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { seedRewards } from "./seed/rewards.js";

async function main() {
  assertRuntimeEnvironment(process.env, { seed: true });
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    await seedRewards(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(publicErrorText(error));
  process.exit(1);
});
