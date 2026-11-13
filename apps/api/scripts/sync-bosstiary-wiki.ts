/**
 * Enrich BosstiaryBoss rows from Tibia Fandom wikitext (bosses-extracted.json seed list).
 *
 * Usage (from apps/api):
 *   npx tsx scripts/sync-bosstiary-wiki.ts
 *   npx tsx scripts/sync-bosstiary-wiki.ts --limit=5
 *   npx tsx scripts/sync-bosstiary-wiki.ts --slug=abyssador
 */
import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  BosstiaryAccessStatus,
  BosstiaryHuntMode,
  Difficulty,
  PrismaClient,
} from '../generated/prisma/client.js';
import {
  BosstiaryWikiParsed,
  combineWikiStrategyField,
  mergeWikiParsedIntoExisting,
} from '../src/bosstiary/bosstiary-wiki-sync.js';

const REPO_ROOT = path.resolve(process.cwd(), '../..');
const SOURCE_JSON = path.join(REPO_ROOT, 'scripts/bosses-extracted.json');
const BACKUP_JSON = path.join(REPO_ROOT, 'scripts/bosstiary-enriched.json');
const WIKI_API = 'https://tibia.fandom.com/api.php';
const REQUEST_DELAY_MS = 300;

const JUNK_LOOT = new Set([
  'Gold Coin',
  'Platinum Coin',
  'Crystal Coin',
  'Health Potion',
  'Mana Potion',
  'Spirit Potion',
  'Great Health Potion',
  'Great Mana Potion',
  'Ultimate Health Potion',
  'Supreme Health Potion',
  'Ultimate Mana Potion',
  'Ultimate Spirit Potion',
]);

type SeedBoss = {
  name: string;
  slug: string;
  sourceUrl: string;
};

type ParsedWiki = BosstiaryWikiParsed & { hp: number | null };

type EnrichedRow = SeedBoss & BosstiaryWikiParsed & { wikiTitle: string; updatedAt: string; hp: number | null };

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs() {
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const slugArg = process.argv.find((arg) => arg.startsWith('--slug='));
  return {
    limit: limitArg ? Number(limitArg.split('=')[1]) : undefined,
    slug: slugArg ? slugArg.split('=')[1]?.trim().toLowerCase() : undefined,
  };
}

function wikiPageTitle(seed: SeedBoss) {
  try {
    const url = new URL(seed.sourceUrl);
    const segment = decodeURIComponent(url.pathname.split('/').pop() ?? seed.name);
    if (segment) return segment.replace(/_/g, ' ');
  } catch {
    // fall through
  }
  return seed.name.trim();
}

function parseInfoboxParams(wikitext: string): Map<string, string> {
  const params = new Map<string, string>();
  const body =
    wikitext.match(/\{\{Infobox Creature[\s\S]*?\n\}\}/i)?.[0] ??
    wikitext.match(/\{\{Infobox[\s\S]*?\n\}\}/i)?.[0] ??
    wikitext;
  const pattern = /\n\|\s*([a-zA-Z0-9_]+)\s*=\s*([\s\S]*?)(?=\n\||\n\}\})/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    params.set(match[1].toLowerCase(), match[2].trim());
  }
  return params;
}

function cleanWikiText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\{\{Loot Item\|([^}|]+)(?:\|[^}]*)?\}\}/gi, '$1')
    .replace(/\{\{[^}]+\}\}/g, ' ')
    .replace(/\[\[([^|\]]+)\|([^\]]+)]]/g, '$2')
    .replace(/\[\[([^\]]+)]]/g, '$1')
    .replace(/'''+/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseHp(raw: string | undefined): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  const hp = Number(digits);
  return Number.isFinite(hp) ? hp : null;
}

function normalizeOfficialCategory(raw: string | undefined): string | null {
  const value = cleanWikiText(raw ?? '').toLowerCase();
  if (!value || value === '--') return null;
  if (value.includes('bane')) return 'Bane';
  if (value.includes('nemesis')) return 'Nemesis';
  if (value.includes('archfoe') || value.includes('arch foe')) return 'Archfoe';
  return null;
}

function bossPointsForCategory(category: string | null) {
  if (category === 'Bane') return 5;
  if (category === 'Nemesis') return 30;
  if (category === 'Archfoe') return 10;
  return null;
}

function parseCooldownSeconds(raw: string | undefined) {
  const cleaned = cleanWikiText(raw ?? '');
  if (!cleaned || cleaned === '--' || /^no$/i.test(cleaned)) return null;
  const hours = Number(cleaned.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(hours) || hours <= 0) return null;
  return Math.round(hours * 3600);
}

function parseStrategyField(params: Map<string, string>) {
  const loot = parseLoot(params);
  const combat = cleanWikiText(params.get('strategy') ?? '') || null;
  return combineWikiStrategyField(loot, combat);
}

function parseLoot(params: Map<string, string>) {
  const lootBlock = params.get('loot') ?? '';
  const items = new Set<string>();
  const lootItemPattern = /\{\{Loot Item\|([^}|]+)(?:\|[^}]*)?\}\}/gi;
  let match: RegExpExecArray | null;
  while ((match = lootItemPattern.exec(lootBlock)) !== null) {
    const name = cleanWikiText(match[1]);
    if (!name || JUNK_LOOT.has(name)) continue;
    items.add(name);
  }
  if (items.size === 0) {
    const fallback = cleanWikiText(lootBlock);
    if (fallback && !JUNK_LOOT.has(fallback)) items.add(fallback);
  }
  const list = [...items];
  if (list.length === 0) return null;
  return `Drops principais: ${list.join(', ')}`;
}

function parseMechanics(params: Map<string, string>) {
  const chunks: string[] = [];
  const abilities = cleanWikiText(params.get('abilities') ?? '');
  if (abilities) chunks.push(`Habilidades: ${abilities.slice(0, 420)}${abilities.length > 420 ? '…' : ''}`);
  const immune: string[] = [];
  if (/yes/i.test(params.get('paraimmune') ?? '')) immune.push('paralisia');
  if (/yes/i.test(params.get('senseinvis') ?? '')) immune.push('invisível');
  if (immune.length) chunks.push(`Imunidades: ${immune.join(', ')}`);
  const weak: string[] = [];
  for (const [key, label] of [
    ['firedmgmod', 'fogo'],
    ['icedmgmod', 'gelo'],
    ['holydmgmod', 'sagrado'],
    ['deathdmgmod', 'morte'],
    ['energydmgmod', 'energia'],
    ['earthdmgmod', 'terra'],
  ] as const) {
    const mod = params.get(key);
    const numeric = mod ? Number(mod.replace(/[^\d.]/g, '')) : NaN;
    if (Number.isFinite(numeric) && numeric > 100) weak.push(label);
  }
  if (weak.length) chunks.push(`Fraquezas: ${weak.join(', ')}`);
  if (!chunks.length) return null;
  return chunks.join(' · ');
}

function estimateByHp(hp: number, officialCategory: string | null) {
  if (officialCategory === 'Nemesis' || hp > 150_000) {
    return {
      recommendedLevelSolo: 700,
      recommendedLevelParty: 400,
      difficulty: Difficulty.VERY_HARD,
      huntMode: BosstiaryHuntMode.PARTY,
    };
  }
  if (hp > 50_000) {
    return {
      recommendedLevelSolo: 450,
      recommendedLevelParty: 250,
      difficulty: Difficulty.HARD,
      huntMode: BosstiaryHuntMode.PARTY,
    };
  }
  if (hp > 15_000) {
    return {
      recommendedLevelSolo: 250,
      recommendedLevelParty: 150,
      difficulty: Difficulty.MEDIUM,
      huntMode: BosstiaryHuntMode.SOLO,
    };
  }
  return {
    recommendedLevelSolo: 100,
    recommendedLevelParty: 80,
    difficulty: Difficulty.EASY,
    huntMode: BosstiaryHuntMode.SOLO,
  };
}

function emptyLevelEstimate() {
  return {
    recommendedLevelSolo: null as number | null,
    recommendedLevelParty: null as number | null,
    difficulty: null as Difficulty | null,
    huntMode: null as BosstiaryHuntMode | null,
  };
}

function parseQuest(params: Map<string, string>) {
  const quest = cleanWikiText(params.get('quest') ?? '');
  if (!quest || quest === '--' || /^no$/i.test(quest)) {
    return { accessStatus: BosstiaryAccessStatus.NONE, accessRequirements: null as string | null };
  }
  return { accessStatus: BosstiaryAccessStatus.REQUIRED, accessRequirements: quest };
}

function parseWiki(wikitext: string): ParsedWiki {
  const params = parseInfoboxParams(wikitext);
  const officialCategory = normalizeOfficialCategory(params.get('bosstiaryclass'));
  const hp = parseHp(params.get('hp'));
  const quest = parseQuest(params);
  const estimate = hp != null ? estimateByHp(hp, officialCategory) : emptyLevelEstimate();
  const locationName = cleanWikiText(params.get('location') ?? '') || null;
  const originCity = cleanWikiText(params.get('city') ?? '') || null;
  return {
    officialCategory,
    bossPoints: bossPointsForCategory(officialCategory),
    locationName,
    originCity,
    accessRequirements: quest.accessRequirements,
    accessStatus: quest.accessStatus,
    cooldownSeconds: parseCooldownSeconds(params.get('cooldown')),
    strategy: parseStrategyField(params),
    mechanics: parseMechanics(params),
    hp,
    ...estimate,
  };
}

function existingWikiSnapshot(
  row: Awaited<ReturnType<PrismaClient['bosstiaryBoss']['findUnique']>>,
): BosstiaryWikiParsed | null {
  if (!row) return null;
  return {
    officialCategory: row.officialCategory,
    bossPoints: row.bossPoints,
    locationName: row.locationName,
    originCity: row.originCity,
    accessRequirements: row.accessRequirements,
    accessStatus: row.accessStatus,
    cooldownSeconds: row.cooldownSeconds,
    strategy: row.strategy,
    mechanics: row.mechanics,
    recommendedLevelSolo: row.recommendedLevelSolo,
    recommendedLevelParty: row.recommendedLevelParty,
    difficulty: row.difficulty,
    huntMode: row.huntMode,
  };
}

async function fetchWikitext(pageTitle: string): Promise<string> {
  const url = new URL(WIKI_API);
  url.searchParams.set('action', 'parse');
  url.searchParams.set('page', pageTitle);
  url.searchParams.set('prop', 'wikitext');
  url.searchParams.set('format', 'json');
  const response = await fetch(url, {
    headers: { 'User-Agent': 'RuneCodexBosstiarySync/1.0 (contact: renan)' },
  });
  if (!response.ok) {
    throw new Error(`Wiki HTTP ${response.status} for ${pageTitle}`);
  }
  const payload = (await response.json()) as {
    error?: { info?: string };
    parse?: { wikitext?: { '*': string } };
  };
  if (payload.error) {
    throw new Error(payload.error.info ?? `Wiki error for ${pageTitle}`);
  }
  const wikitext = payload.parse?.wikitext?.['*'];
  if (!wikitext) throw new Error(`Wikitext vazio para ${pageTitle}`);
  return wikitext;
}

function isSeedRow(value: unknown): value is SeedBoss {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.name === 'string' &&
    typeof row.slug === 'string' &&
    typeof row.sourceUrl === 'string'
  );
}

async function main() {
  const { limit, slug } = parseArgs();
  const raw = JSON.parse(await readFile(SOURCE_JSON, 'utf8')) as unknown[];
  let seeds = raw.filter(isSeedRow);
  if (slug) seeds = seeds.filter((row) => row.slug === slug);
  if (limit && limit > 0) seeds = seeds.slice(0, limit);
  if (seeds.length === 0) throw new Error('Nenhum boss para sincronizar.');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: requiredEnv('DATABASE_URL') }),
  });

  const backup: EnrichedRow[] = [];
  let index = 0;

  try {
    for (const seed of seeds) {
      index += 1;
      const wikiTitle = wikiPageTitle(seed);
      try {
        const wikitext = await fetchWikitext(wikiTitle);
        const parsed = parseWiki(wikitext);
        const { hp: _hp, ...wikiFields } = parsed;
        const existingRow = await prisma.bosstiaryBoss.findUnique({ where: { slug: seed.slug } });
        const merged = mergeWikiParsedIntoExisting(existingWikiSnapshot(existingRow), wikiFields);
        const data = {
          ...merged,
          accessStatus: merged.accessStatus ?? BosstiaryAccessStatus.UNKNOWN,
        };
        await prisma.bosstiaryBoss.upsert({
          where: { slug: seed.slug },
          create: {
            slug: seed.slug,
            name: seed.name,
            isActive: true,
            ...data,
          },
          update: {
            name: seed.name,
            ...data,
          },
        });
        backup.push({
          ...seed,
          ...data,
          hp: parsed.hp,
          wikiTitle,
          updatedAt: new Date().toISOString(),
        });
        console.log(`[${index}/${seeds.length}] ${seed.name} -> Atualizado`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[${index}/${seeds.length}] ${seed.name} -> Falhou (${message})`);
      }
      if (index < seeds.length) await sleep(REQUEST_DELAY_MS);
    }
  } finally {
    await prisma.$disconnect();
  }

  await writeFile(BACKUP_JSON, `${JSON.stringify(backup, null, 2)}\n`, 'utf8');
  console.log(`Backup salvo em ${BACKUP_JSON} (${backup.length} registros).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
