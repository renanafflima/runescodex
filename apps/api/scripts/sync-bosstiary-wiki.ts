/**
 * Enrich BosstiaryBoss rows from Tibia Wiki wikitext.
 *
 * Usage (from apps/api):
 *   npx tsx scripts/sync-bosstiary-wiki.ts --dry-run --targets=../../scripts/bosstiary-enrichment-targets.json
 *   npx tsx scripts/sync-bosstiary-wiki.ts --apply --targets=../../scripts/bosstiary-enrichment-targets.json
 *   npx tsx scripts/sync-bosstiary-wiki.ts --apply --slug=abyssador
 */
import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { BosstiaryAccessStatus, PrismaClient } from '../generated/prisma/client.js';
import {
  databaseHost,
  resolveAppEnv,
} from '../src/common/database-target.js';
import {
  fetchWikiPageWithAliases,
  parseWikiBoss,
  sanitizeWikiParsed,
  validateWikiPageTitle,
  normalizeTitleToken,
} from '../src/bosstiary/bosstiary-wiki-parse.js';
import {
  BosstiaryWikiParsed,
  BosstiaryWikiPersisted,
  diffWikiPersisted,
  mergeWikiParsedIntoExisting,
  normalizeLegacyStrategyField,
} from '../src/bosstiary/bosstiary-wiki-sync.js';

const REPO_ROOT = path.resolve(process.cwd(), '../..');
const SOURCE_JSON = path.join(REPO_ROOT, 'scripts/bosses-extracted.json');
const DEFAULT_TARGETS = path.join(REPO_ROOT, 'scripts/bosstiary-enrichment-targets.json');
const REPORT_JSON = path.join(REPO_ROOT, 'scripts/bosstiary-sync-report.json');
const ALIASES_JSON = path.join(REPO_ROOT, 'scripts/bosstiary-wiki-aliases.json');
const REQUEST_DELAY_MS = 300;

type SeedBoss = {
  name: string;
  slug: string;
  sourceUrl: string;
};

type SyncReportRow = {
  slug: string;
  name: string;
  status: 'updated' | 'unchanged' | 'failed' | 'rejected' | 'skipped';
  wikiTitle?: string;
  wikiSource?: string;
  message?: string;
  diff?: ReturnType<typeof diffWikiPersisted>;
};

const EMPTY_WIKI_PARSED: BosstiaryWikiParsed = {
  officialCategory: null,
  bossPoints: null,
  locationName: null,
  locationRegion: null,
  originCity: null,
  howToReach: null,
  accessRequirements: null,
  accessStatus: null,
  cooldownSeconds: null,
  strategy: null,
  mechanics: null,
  recommendedLevelSolo: null,
  recommendedLevelParty: null,
  difficulty: null,
  huntMode: null,
};

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
  const targetsArg = process.argv.find((arg) => arg.startsWith('--targets='));
  const apply = process.argv.includes('--apply');
  const dryRun = process.argv.includes('--dry-run') || !apply;
  const normalizeOnly = process.argv.includes('--normalize-only');
  return {
    limit: limitArg ? Number(limitArg.split('=')[1]) : undefined,
    slug: slugArg ? slugArg.split('=')[1]?.trim().toLowerCase() : undefined,
    targetsFile: targetsArg ? targetsArg.split('=')[1]?.trim() : DEFAULT_TARGETS,
    apply,
    dryRun,
    normalizeOnly,
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

function isSeedRow(value: unknown): value is SeedBoss {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.name === 'string' &&
    typeof row.slug === 'string' &&
    typeof row.sourceUrl === 'string'
  );
}

function existingWikiSnapshot(row: {
  officialCategory: string | null;
  bossPoints: number | null;
  locationName: string | null;
  locationRegion: string | null;
  originCity: string | null;
  howToReach: string | null;
  accessRequirements: string | null;
  accessStatus: BosstiaryAccessStatus;
  cooldownSeconds: number | null;
  strategy: string | null;
  mechanics: string | null;
  recommendedLevelSolo: number | null;
  recommendedLevelParty: number | null;
  difficulty: string | null;
  huntMode: string | null;
}): BosstiaryWikiPersisted {
  return {
    officialCategory: row.officialCategory,
    bossPoints: row.bossPoints,
    locationName: row.locationName,
    locationRegion: row.locationRegion,
    originCity: row.originCity,
    howToReach: row.howToReach,
    accessRequirements: row.accessRequirements,
    accessStatus: row.accessStatus,
    cooldownSeconds: row.cooldownSeconds,
    strategy: row.strategy,
    mechanics: row.mechanics,
    recommendedLevelSolo: row.recommendedLevelSolo,
    recommendedLevelParty: row.recommendedLevelParty,
    difficulty: row.difficulty as BosstiaryWikiParsed['difficulty'],
    huntMode: row.huntMode as BosstiaryWikiParsed['huntMode'],
  };
}

function finalizeMerged(existing: BosstiaryWikiPersisted, merged: BosstiaryWikiPersisted): BosstiaryWikiPersisted {
  const strategy = normalizeLegacyStrategyField(merged.strategy) ?? merged.strategy;
  return {
    ...merged,
    strategy,
    accessStatus: merged.accessStatus ?? existing.accessStatus ?? BosstiaryAccessStatus.UNKNOWN,
  };
}

async function loadTargetSlugs(targetsFile: string) {
  const raw = JSON.parse(await readFile(targetsFile, 'utf8')) as unknown;
  if (!Array.isArray(raw) || raw.some((slug) => typeof slug !== 'string')) {
    throw new Error(`Arquivo de targets inválido: ${targetsFile}`);
  }
  return raw.map((slug) => slug.trim().toLowerCase());
}

async function exportBackup(
  prisma: PrismaClient,
  slugs: string[],
  backupDir: string,
) {
  await mkdir(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(backupDir, `bosstiary-pre-sync-${stamp}.json`);
  const rows = await prisma.bosstiaryBoss.findMany({
    where: { slug: { in: slugs } },
    orderBy: { slug: 'asc' },
  });
  await writeFile(file, `${JSON.stringify({ exportedAt: new Date().toISOString(), rows }, null, 2)}\n`, 'utf8');
  return { file, count: rows.length };
}

async function main() {
  const { limit, slug, targetsFile, apply, dryRun, normalizeOnly } = parseArgs();
  const connectionString = requiredEnv('DATABASE_URL');
  const appEnv = resolveAppEnv(process.env);
  const dbHost = databaseHost(connectionString);
  const modeLabel = normalizeOnly ? 'normalize-only' : dryRun ? 'dry-run' : 'apply';
  console.log(`[sync] APP_ENV=${appEnv} dbHost=${dbHost} mode=${modeLabel}`);

  const targetSlugs = slug ? [slug] : await loadTargetSlugs(targetsFile);
  const limitedSlugs =
    limit && limit > 0 ? targetSlugs.slice(0, limit) : targetSlugs;
  if (limitedSlugs.length === 0) throw new Error('Nenhum boss alvo.');

  const raw = JSON.parse(await readFile(SOURCE_JSON, 'utf8')) as unknown[];
  const seeds = raw.filter(isSeedRow);
  const seedBySlug = new Map(seeds.map((row) => [row.slug, row]));
  const aliasMap = JSON.parse(await readFile(ALIASES_JSON, 'utf8')) as Record<string, string[]>;

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  const report: SyncReportRow[] = [];
  let backupPath: string | null = null;

  try {
    if (apply) {
      const backup = await exportBackup(
        prisma,
        limitedSlugs,
        path.join(REPO_ROOT, 'scripts/backups'),
      );
      backupPath = backup.file;
      console.log(`[sync] Backup: ${backup.file} (${backup.count} registros)`);
    }

    const dbRows = await prisma.bosstiaryBoss.findMany({
      where: { slug: { in: limitedSlugs } },
    });
    const rowBySlug = new Map(dbRows.map((row) => [row.slug, row]));
    const missingInDb = limitedSlugs.filter((item) => !rowBySlug.has(item));
    if (missingInDb.length) {
      console.warn(`[sync] Slugs ausentes no banco: ${missingInDb.join(', ')}`);
    }

    let index = 0;
    for (const targetSlug of limitedSlugs) {
      index += 1;
      const dbRow = rowBySlug.get(targetSlug);
      if (!dbRow) {
        report.push({
          slug: targetSlug,
          name: targetSlug,
          status: 'skipped',
          message: 'Registro não encontrado no banco.',
        });
        continue;
      }

      const seed = seedBySlug.get(targetSlug) ?? {
        name: dbRow.name,
        slug: dbRow.slug,
        sourceUrl: `https://www.tibiawiki.com.br/wiki/${dbRow.name.replace(/ /g, '_')}`,
      };
      const pageTitles = [
        wikiPageTitle(seed),
        ...(aliasMap[targetSlug] ?? []),
        dbRow.name,
      ];

      try {
        if (normalizeOnly) {
          const existing = existingWikiSnapshot(dbRow);
          const merged = finalizeMerged(existing, mergeWikiParsedIntoExisting(existing, EMPTY_WIKI_PARSED));
          const diff = diffWikiPersisted(existing, merged);
          if (Object.keys(diff).length === 0) {
            report.push({ slug: targetSlug, name: dbRow.name, status: 'unchanged' });
            console.log(`[${index}/${limitedSlugs.length}] ${dbRow.name} -> Sem alterações`);
            continue;
          }
          if (!dryRun && apply) {
            await prisma.bosstiaryBoss.update({
              where: { slug: targetSlug },
              data: { strategy: merged.strategy },
            });
            report.push({ slug: targetSlug, name: dbRow.name, status: 'updated', diff });
            console.log(`[${index}/${limitedSlugs.length}] ${dbRow.name} -> Normalizado`);
          } else {
            report.push({
              slug: targetSlug,
              name: dbRow.name,
              status: 'unchanged',
              diff,
              message: 'dry-run (normalize)',
            });
          }
          continue;
        }

        const fetched = await fetchWikiPageWithAliases(pageTitles);
        const aliasTitles = aliasMap[targetSlug] ?? [];
        const titleMatches =
          validateWikiPageTitle(dbRow.name, fetched.title) ||
          validateWikiPageTitle(seed.name, fetched.title) ||
          aliasTitles.some((alias) => validateWikiPageTitle(alias, fetched.title)) ||
          normalizeTitleToken(fetched.title).includes(normalizeTitleToken(dbRow.name).split(' ')[0] ?? '');
        if (!titleMatches) {
          report.push({
            slug: targetSlug,
            name: dbRow.name,
            status: 'rejected',
            wikiTitle: fetched.title,
            wikiSource: fetched.source,
            message: `Título da wiki não corresponde ao boss (${seed.name}).`,
          });
          console.error(`[${index}/${limitedSlugs.length}] ${dbRow.name} -> Rejeitado (título ${fetched.title})`);
          continue;
        }

        const parsedBoss = sanitizeWikiParsed(
          parseWikiBoss(fetched.wikitext, fetched.title, fetched.source),
        );
        const { hp: _hp, wikiTitle: _t, wikiSource: _s, ...wikiFields } = parsedBoss;
        const existing = existingWikiSnapshot(dbRow);
        const merged = finalizeMerged(existing, mergeWikiParsedIntoExisting(existing, wikiFields));
        const diff = diffWikiPersisted(existing, merged);
        const hasChanges = Object.keys(diff).length > 0;

        if (hasChanges) {
          console.log(`[${index}/${limitedSlugs.length}] ${dbRow.name}`);
          for (const [field, change] of Object.entries(diff)) {
            console.log(`  ${field}: ${JSON.stringify(change?.before)} -> ${JSON.stringify(change?.after)}`);
          }
        }

        if (!hasChanges) {
          report.push({
            slug: targetSlug,
            name: dbRow.name,
            status: 'unchanged',
            wikiTitle: fetched.title,
            wikiSource: fetched.source,
          });
          console.log(`[${index}/${limitedSlugs.length}] ${dbRow.name} -> Sem alterações`);
        } else if (dryRun) {
          report.push({
            slug: targetSlug,
            name: dbRow.name,
            status: 'unchanged',
            wikiTitle: fetched.title,
            wikiSource: fetched.source,
            diff,
            message: 'dry-run (não gravado)',
          });
          console.log(`[${index}/${limitedSlugs.length}] ${dbRow.name} -> dry-run (${Object.keys(diff).length} campos)`);
        } else {
          await prisma.bosstiaryBoss.update({
            where: { slug: targetSlug },
            data: {
              locationName: merged.locationName,
              locationRegion: merged.locationRegion,
              originCity: merged.originCity,
              howToReach: merged.howToReach,
              accessRequirements: merged.accessRequirements,
              accessStatus: merged.accessStatus ?? BosstiaryAccessStatus.UNKNOWN,
              officialCategory: merged.officialCategory,
              bossPoints: merged.bossPoints,
              cooldownSeconds: merged.cooldownSeconds,
              strategy: merged.strategy,
              mechanics: merged.mechanics,
              recommendedLevelSolo: merged.recommendedLevelSolo,
              recommendedLevelParty: merged.recommendedLevelParty,
              difficulty: merged.difficulty,
              huntMode: merged.huntMode,
            },
          });
          report.push({
            slug: targetSlug,
            name: dbRow.name,
            status: 'updated',
            wikiTitle: fetched.title,
            wikiSource: fetched.source,
            diff,
          });
          console.log(`[${index}/${limitedSlugs.length}] ${dbRow.name} -> Atualizado`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const existing = existingWikiSnapshot(dbRow);
        const merged = finalizeMerged(existing, mergeWikiParsedIntoExisting(existing, EMPTY_WIKI_PARSED));
        const diff = diffWikiPersisted(existing, merged);
        if (Object.keys(diff).length > 0) {
          console.log(`[${index}/${limitedSlugs.length}] ${dbRow.name} -> normalização local (${message})`);
          if (!dryRun && apply) {
            await prisma.bosstiaryBoss.update({
              where: { slug: targetSlug },
              data: { strategy: merged.strategy },
            });
            report.push({
              slug: targetSlug,
              name: dbRow.name,
              status: 'updated',
              message: `normalização sem wiki (${message})`,
              diff,
            });
          } else {
            report.push({
              slug: targetSlug,
              name: dbRow.name,
              status: 'failed',
              message,
              diff,
            });
          }
        } else {
          report.push({
            slug: targetSlug,
            name: dbRow.name,
            status: 'failed',
            message,
          });
        }
        console.error(`[${index}/${limitedSlugs.length}] ${dbRow.name} -> Falhou (${message})`);
      }

      if (index < limitedSlugs.length) await sleep(REQUEST_DELAY_MS);
    }
  } finally {
    await prisma.$disconnect();
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    mode: dryRun ? 'dry-run' : 'apply',
    appEnv,
    dbHost,
    backupPath,
    targets: limitedSlugs,
    totals: {
      updated: report.filter((row) => row.status === 'updated').length,
      unchanged: report.filter((row) => row.status === 'unchanged' && !row.diff).length,
      dryRunChanges: report.filter((row) => row.diff && row.message?.includes('dry-run')).length,
      failed: report.filter((row) => row.status === 'failed').length,
      rejected: report.filter((row) => row.status === 'rejected').length,
      skipped: report.filter((row) => row.status === 'skipped').length,
    },
    rows: report,
  };

  await writeFile(REPORT_JSON, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`[sync] Relatório: ${REPORT_JSON}`);
  console.log(JSON.stringify(summary.totals, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
