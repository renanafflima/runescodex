/**
 * Generates idempotent BosstiaryBoss expansion migration from final validation.
 * Usage: node scripts/generate-bosstiary-expansion-migration.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');

const EXCLUDED_SLUGS = new Set([
  'owin-criatura',
  'the-first-dragon-criatura',
  'tentuglys-head',
  'tentugly-s-head',
  'hatebreeder',
]);

const ALIAS_WIKI_SLUGS = new Set([
  'count-vlarkorth',
  'duke-krule',
  'sir-nictros',
  'timira-the-many-headed',
]);

function loadJson(rel) {
  return JSON.parse(readFileSync(path.join(REPO, rel), 'utf8').replace(/^\uFEFF/, ''));
}

function sqlEscape(value) {
  return value.replace(/'/g, "''");
}

function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\(criatura\)/gi, '')
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function main() {
  const validation = loadJson('scripts/bosstiary-catalog-final-validation.json');
  const targets = new Set(loadJson('scripts/bosstiary-enrichment-targets.json'));
  const rows = [];

  for (const boss of validation.newValidBosses.bosses) {
    const slug = boss.proposedInternalSlug?.trim() || boss.wikiSlug?.trim();
    if (!slug || !boss.officialWikiName) continue;
    if (EXCLUDED_SLUGS.has(slug) || ALIAS_WIKI_SLUGS.has(slug)) continue;
    if (targets.has(slug)) continue;
    if (rows.some((row) => row.slug === slug)) continue;
    const category = boss.bosstiaryCategory;
    if (!['Bane', 'Archfoe', 'Nemesis'].includes(category)) {
      throw new Error(`Categoria inválida para ${slug}: ${category}`);
    }
    rows.push({
      slug,
      name: boss.officialWikiName,
      officialCategory: category,
      sourceUrl: boss.sourceUrl,
    });
  }

  rows.sort((a, b) => a.slug.localeCompare(b.slug, 'en'));
  if (rows.length !== 295) {
    throw new Error(`Esperado 295 inserts (297 − 2 excluídos); obtido ${rows.length}.`);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: 'scripts/bosstiary-catalog-final-validation.json',
    insertCount: rows.length,
    preservedExistingTargets: [...targets],
    excludedSlugs: [...EXCLUDED_SLUGS],
    aliasWikiSlugsSkipped: [...ALIAS_WIKI_SLUGS],
    expectedTotalAfterMigration: targets.size + rows.length,
    bosses: rows,
  };

  writeFileSync(
    path.join(REPO, 'scripts/bosstiary-expansion-insert-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  const lines = [];
  lines.push('-- Bosstiary: insert confirmed wiki bosses (idempotent). Does not UPDATE existing rows.');
  lines.push('-- Source: scripts/bosstiary-catalog-final-validation.json (295 of 297; excludes owin/first-dragon).');
  lines.push('BEGIN;');
  lines.push('');

  const batchSize = 25;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values = batch
      .map(
        (row) =>
          `  ('${sqlEscape(row.slug)}', '${sqlEscape(row.name)}', '${sqlEscape(row.officialCategory)}')`,
      )
      .join(',\n');
    lines.push(
      'INSERT INTO "BosstiaryBoss" ("id", "slug", "name", "officialCategory", "accessStatus", "isActive", "createdAt", "updatedAt")',
    );
    lines.push('SELECT gen_random_uuid()::text, v.slug, v.name, v."officialCategory", \'UNKNOWN\'::"BosstiaryAccessStatus", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP');
    lines.push(`FROM (VALUES`);
    lines.push(`${values}`);
    lines.push(') AS v(slug, name, "officialCategory")');
    lines.push('WHERE NOT EXISTS (SELECT 1 FROM "BosstiaryBoss" b WHERE b.slug = v.slug);');
    lines.push('');
  }

  lines.push('COMMIT;');

  const migrationDir = path.join(
    REPO,
    'apps/api/prisma/migrations/20261113180000_bosstiary_expand_confirmed_catalog',
  );
  mkdirSync(migrationDir, { recursive: true });
  writeFileSync(path.join(migrationDir, 'migration.sql'), `${lines.join('\n')}\n`);

  console.log(
    JSON.stringify(
      { insertCount: rows.length, migrationDir, manifest: 'scripts/bosstiary-expansion-insert-manifest.json' },
      null,
      2,
    ),
  );
}

main();
