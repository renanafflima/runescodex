/**
 * Print enrichment status for target bosses (read-only).
 * Usage: npx tsx scripts/bosstiary-export-status.ts
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import {
  BOSSTIARY_COMBAT_STRATEGY_MARKER,
  BOSSTIARY_LOOT_STRATEGY_PREFIX,
} from '../src/bosstiary/bosstiary-wiki-sync.js';

const REPO_ROOT = path.resolve(process.cwd(), '../..');
const TARGETS = path.join(REPO_ROOT, 'scripts/bosstiary-enrichment-targets.json');

function lootPart(strategy: string | null) {
  if (!strategy) return null;
  if (strategy.includes(BOSSTIARY_COMBAT_STRATEGY_MARKER)) {
    return strategy.split(BOSSTIARY_COMBAT_STRATEGY_MARKER)[0]?.replace(BOSSTIARY_LOOT_STRATEGY_PREFIX, '').trim();
  }
  if (strategy.startsWith(BOSSTIARY_LOOT_STRATEGY_PREFIX)) {
    return strategy.slice(BOSSTIARY_LOOT_STRATEGY_PREFIX.length).trim();
  }
  return null;
}

function strategyPart(strategy: string | null) {
  if (!strategy) return null;
  if (strategy.includes(BOSSTIARY_COMBAT_STRATEGY_MARKER)) {
    return strategy.split(BOSSTIARY_COMBAT_STRATEGY_MARKER)[1]?.trim() ?? null;
  }
  if (strategy.startsWith(BOSSTIARY_LOOT_STRATEGY_PREFIX)) return null;
  return strategy;
}

async function main() {
const slugs = JSON.parse(await readFile(TARGETS, 'utf8')) as string[];
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const rows = await prisma.bosstiaryBoss.findMany({
  where: { slug: { in: slugs } },
  orderBy: { slug: 'asc' },
});

const table = rows.map((row) => ({
  slug: row.slug,
  name: row.name,
  location: [row.locationName, row.locationRegion, row.originCity].filter(Boolean).join(' · ') || '—',
  reach: [row.howToReach, row.accessRequirements].filter(Boolean).join(' / ') || '—',
  loot: lootPart(row.strategy) ?? '—',
  strategy: strategyPart(row.strategy) ? 'sim' : row.strategy ? 'texto-misto' : '—',
  solo: row.recommendedLevelSolo ?? '—',
  party: row.recommendedLevelParty ?? '—',
  mechanics: row.mechanics ? 'sim' : '—',
}));

console.log(JSON.stringify({ count: table.length, bosses: table }, null, 2));
await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
