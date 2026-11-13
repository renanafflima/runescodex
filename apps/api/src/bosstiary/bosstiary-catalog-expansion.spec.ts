import { readFileSync } from 'fs';
import { join } from 'path';

const repoRoot = join(__dirname, '../../../../');
const migrationPath = join(
  __dirname,
  '../../prisma/migrations/20261113180000_bosstiary_expand_confirmed_catalog/migration.sql',
);
const manifestPath = join(repoRoot, 'scripts/bosstiary-expansion-insert-manifest.json');
const aliasesPath = join(repoRoot, 'scripts/bosstiary-wiki-aliases.json');
const targetsPath = join(repoRoot, 'scripts/bosstiary-enrichment-targets.json');

function loadJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
}

describe('Bosstiary catalog expansion migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');
  const manifest = loadJson(manifestPath);
  const aliases = loadJson(aliasesPath) as Record<string, string[]>;
  const targets = loadJson(targetsPath) as string[];

  it('inserts 295 new bosses idempotently without updating existing rows', () => {
    expect(manifest.insertCount).toBe(295);
    expect(manifest.bosses).toHaveLength(295);
    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('COMMIT;');
    expect(sql).not.toMatch(/\bUPDATE\s+"BosstiaryBoss"\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\s+"BosstiaryBoss"\b/i);
    const insertBlocks = sql.match(/WHERE NOT EXISTS \(SELECT 1 FROM "BosstiaryBoss"/g) ?? [];
    expect(insertBlocks.length).toBeGreaterThan(0);
    expect(sql).not.toContain('ON CONFLICT');
  });

  it('keeps slugs unique in the manifest', () => {
    const slugs = manifest.bosses.map((row: { slug: string }) => row.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('uses only valid Bosstiary categories', () => {
    for (const row of manifest.bosses) {
      expect(['Bane', 'Archfoe', 'Nemesis']).toContain(row.officialCategory);
    }
  });

  it('does not duplicate the 20 existing targets or alias wiki slugs', () => {
    const targetSet = new Set(targets);
    const wikiAliasSlugs = new Set(
      Object.values(aliases)
        .flat()
        .map((name) =>
          name
            .normalize('NFD')
            .replace(/\p{M}/gu, '')
            .toLowerCase()
            .replace(/'/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, ''),
        ),
    );
    const forbidden = new Set([
      ...targetSet,
      'count-vlarkorth',
      'duke-krule',
      'sir-nictros',
      'timira-the-many-headed',
      'owin-criatura',
      'the-first-dragon-criatura',
    ]);
    for (const row of manifest.bosses) {
      expect(forbidden.has(row.slug)).toBe(false);
    }
    expect(wikiAliasSlugs.has('count-vlarkorth')).toBe(true);
  });

  it('preserves legacy slugs as existing targets only', () => {
    expect(targets).toEqual(
      expect.arrayContaining(['banebringer', 'fluffy', 'yube']),
    );
    const manifestSlugs = new Set(manifest.bosses.map((row: { slug: string }) => row.slug));
    expect(manifestSlugs.has('banebringer')).toBe(false);
    expect(manifestSlugs.has('fluffy')).toBe(false);
    expect(manifestSlugs.has('yube')).toBe(false);
  });

  it('matches SQL slug list to manifest', () => {
    const sqlSlugs = [...sql.matchAll(/\('([a-z0-9-]+)', '/g)].map((match) => match[1]);
    const manifestSlugs = manifest.bosses.map((row: { slug: string }) => row.slug);
    expect(sqlSlugs.sort()).toEqual(manifestSlugs.sort());
  });

  it('documents expected row total after migration', () => {
    expect(manifest.expectedTotalAfterMigration).toBe(315);
  });
});
