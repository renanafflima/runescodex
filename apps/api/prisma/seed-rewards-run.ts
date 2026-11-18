/**
 * Seeds only Rewards missions/catalog. Does not touch hunts, users, wallets,
 * ledger, receipts, or redemptions beyond catalog mission upserts.
 *
 * Usage:
 *   npx tsx prisma/seed-rewards-run.ts
 *
 * Production catalog recovery (explicit opt-in only):
 *   ALLOW_PRODUCTION_REWARDS_CATALOG_SEED=1 APP_ENV=production npx tsx prisma/seed-rewards-run.ts
 */
import "dotenv/config";
import { assertRuntimeEnvironment } from "../src/common/database-target.js";
import { publicErrorText } from "../src/common/redact-error.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { seedRewards } from "./seed/rewards.js";

async function main() {
  const allowProductionCatalog =
    process.env.ALLOW_PRODUCTION_REWARDS_CATALOG_SEED === "1";
  const appEnv = (process.env.APP_ENV || "").toLowerCase();

  if (appEnv === "production" && allowProductionCatalog) {
    // Catalog-only recovery path: still validates JWT/DB target, but permits
    // the rewards catalog upsert that seed normally refuses in production.
    assertRuntimeEnvironment(process.env);
    console.warn(
      "ALLOW_PRODUCTION_REWARDS_CATALOG_SEED=1: upserting Rewards catalog v2 only (no wallet/ledger changes).",
    );
  } else {
    assertRuntimeEnvironment(process.env, { seed: true });
  }

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
