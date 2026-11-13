/**
 * Read-only Bosstiary catalog audit (no DB writes).
 * Usage: node scripts/audit-bosstiary-catalog.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const UA = { 'User-Agent': 'RuneCodexAudit/1.0 (RuneCodex)' };

const WIKI_BOSSTIARY_URL = 'https://www.tibiawiki.com.br/wiki/Bossti%C3%A1rio';
const WIKI_CATEGORY_BOSSES_URL = 'https://www.tibiawiki.com.br/wiki/Categoria:Bosses';
const MONK_URL = 'https://www.tibiamonk.com/en/info/bosstiary';

const CLASSIFICATIONS = [
  'CONFIRMED_BANE',
  'CONFIRMED_ARCHFOE',
  'CONFIRMED_NEMESIS',
  'NOT_IN_BOSSTIARY',
  'NEEDS_VERIFICATION',
];

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

function normalizeName(name) {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\(criatura\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchCategoryMembers(cmtitle) {
  const members = [];
  let cmcontinue;
  do {
    const url = new URL('https://www.tibiawiki.com.br/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('format', 'json');
    url.searchParams.set('list', 'categorymembers');
    url.searchParams.set('cmtitle', cmtitle);
    url.searchParams.set('cmlimit', '500');
    if (cmcontinue) url.searchParams.set('cmcontinue', cmcontinue);
    const response = await fetch(url, { headers: UA });
    const payload = await response.json();
    members.push(...(payload.query?.categorymembers ?? []));
    cmcontinue = payload.continue?.cmcontinue;
  } while (cmcontinue);
  return members.map((row) => row.title);
}

async function loadOfficialWikiBosses() {
  const categories = {
    BANE: 'Categoria:Bosses Bane',
    ARCHFOE: 'Categoria:Bosses Archfoe',
    NEMESIS: 'Categoria:Bosses Nemesis',
  };
  const byCategory = {};
  const bySlug = new Map();
  const byName = new Map();
  const divergences = [];

  for (const [category, cmtitle] of Object.entries(categories)) {
    const names = await fetchCategoryMembers(cmtitle);
    byCategory[category] = names;
    for (const name of names) {
      const slug = slugify(name);
      const existing = bySlug.get(slug);
      if (existing && existing.category !== category) {
        divergences.push({
          slug,
          name,
          categories: [existing.category, category],
          source: 'TibiaWiki category overlap',
        });
      }
      const entry = {
        name,
        slug,
        category,
        wikiUrl: `https://www.tibiawiki.com.br/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`,
        evidence: `Listado em ${cmtitle} (API categorymembers, ${new Date().toISOString().slice(0, 10)})`,
      };
      bySlug.set(slug, entry);
      byName.set(normalizeName(name), entry);
    }
  }

  return { byCategory, bySlug, byName, divergences, totals: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, v.length])) };
}

async function loadMonkBosses() {
  try {
    const response = await fetch(MONK_URL, { headers: UA });
    const html = await response.text();
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) return { byCategory: {}, note: 'NEXT_DATA não encontrado' };

    const payload = JSON.parse(match[1]);
    const buckets = { BANE: [], ARCHFOE: [], NEMESIS: [] };

    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (const item of node) walk(item);
        return;
      }
      const keys = Object.keys(node);
      for (const key of ['bane', 'archfoe', 'nemesis', 'Bane', 'Archfoe', 'Nemesis']) {
        if (key in node && Array.isArray(node[key])) {
          const upper = key.toUpperCase().replace('ARCHFOE', 'ARCHFOE').replace('BANE', 'BANE');
          const mapKey = key.toLowerCase() === 'bane' ? 'BANE' : key.toLowerCase() === 'archfoe' ? 'ARCHFOE' : 'NEMESIS';
          for (const boss of node[key]) {
            if (typeof boss === 'string') buckets[mapKey].push(boss);
            else if (boss && typeof boss.name === 'string') buckets[mapKey].push(boss.name);
          }
        }
      }
      for (const value of Object.values(node)) walk(value);
    };
    walk(payload);

    const dedupe = (list) => [...new Set(list)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return {
      byCategory: {
        BANE: dedupe(buckets.BANE),
        ARCHFOE: dedupe(buckets.ARCHFOE),
        NEMESIS: dedupe(buckets.NEMESIS),
      },
      totals: {
        BANE: dedupe(buckets.BANE).length,
        ARCHFOE: dedupe(buckets.ARCHFOE).length,
        NEMESIS: dedupe(buckets.NEMESIS).length,
      },
      sourceUrl: MONK_URL,
    };
  } catch (error) {
    return { byCategory: {}, note: error instanceof Error ? error.message : String(error) };
  }
}

function monkSlugSets(monk) {
  const sets = { BANE: new Set(), ARCHFOE: new Set(), NEMESIS: new Set() };
  for (const [cat, names] of Object.entries(monk.byCategory ?? {})) {
    for (const name of names) sets[cat].add(slugify(name));
  }
  return sets;
}

function classificationFromCategory(category) {
  if (category === 'BANE') return 'CONFIRMED_BANE';
  if (category === 'ARCHFOE') return 'CONFIRMED_ARCHFOE';
  if (category === 'NEMESIS') return 'CONFIRMED_NEMESIS';
  return 'NEEDS_VERIFICATION';
}

const MINI_BOSSES = [
  'Grand Canon Dominus',
  'Grand Chaplain Gaunder',
  'Grand Commander Soeren',
  'Jailer',
  'Scarlett Etzel',
];

function buildRecord(candidate, wikiOfficial, monkSets, monk) {
  const notes = [];
  let match = wikiOfficial.bySlug.get(candidate.slug);
  if (!match) {
    match = wikiOfficial.byName.get(normalizeName(candidate.name)) ?? null;
    if (match) notes.push(`Slug local (${candidate.slug}) difere do título wiki (${match.slug}).`);
  }

  const monkCategory = (() => {
    if (monkSets.BANE.has(candidate.slug)) return 'BANE';
    if (monkSets.ARCHFOE.has(candidate.slug)) return 'ARCHFOE';
    if (monkSets.NEMESIS.has(candidate.slug)) return 'NEMESIS';
    const norm = normalizeName(candidate.name);
    for (const [cat, names] of Object.entries(monk.byCategory ?? {})) {
      if (names.some((n) => normalizeName(n) === norm)) return cat;
    }
    return null;
  })();

  if (!match) {
    const fuzzy = [...wikiOfficial.bySlug.values()].find(
      (row) => normalizeName(row.name) === normalizeName(candidate.name),
    );
    if (fuzzy) {
      match = fuzzy;
      notes.push('Correspondência por nome normalizado.');
    }
  }

  let classification;
  let sources = [];
  let evidence = [];
  let bosstiaryCategory = null;
  let officialName = candidate.name;

  if (match) {
    classification = classificationFromCategory(match.category);
    bosstiaryCategory = match.category.charAt(0) + match.category.slice(1).toLowerCase();
    officialName = match.name;
    sources.push({
      name: 'TibiaWiki — categorias Bosstiário',
      url: match.wikiUrl,
    });
    evidence.push(match.evidence);
    sources.push({ name: 'TibiaWiki — página Bosstiário', url: WIKI_BOSSTIARY_URL });

    if (monkCategory && monkCategory !== match.category) {
      classification = 'NEEDS_VERIFICATION';
      notes.push(
        `Divergência: TibiaWiki=${match.category}, TibiaMonk=${monkCategory} (slug ${candidate.slug}).`,
      );
      sources.push({ name: 'Tibia Monk — Bosstiary', url: MONK_URL });
      evidence.push(`TibiaMonk lista em ${monkCategory}`);
    } else if (monkCategory) {
      sources.push({ name: 'Tibia Monk — Bosstiary', url: MONK_URL });
      evidence.push(`Confirmado também em TibiaMonk (${monkCategory})`);
    } else if ((monk.byCategory?.BANE?.length ?? 0) > 0) {
      classification = 'NEEDS_VERIFICATION';
      notes.push('Presente no TibiaWiki Bosstiário, mas não localizado na lista TibiaMonk parseada.');
      sources.push({ name: 'Tibia Monk — Bosstiary', url: MONK_URL });
    }
  } else {
    classification = 'NOT_IN_BOSSTIARY';
    sources.push(
      { name: 'TibiaWiki — categoria Bosses (candidato)', url: candidate.sourceUrl },
      { name: 'TibiaWiki — página Bosstiário (ausência)', url: WIKI_BOSSTIARY_URL },
    );
    evidence.push(
      'Ausente das categorias Categoria:Bosses Bane/Archfoe/Nemesis via API (lista oficial do Bosstiário na TibiaWiki BR).',
    );
    if (monkCategory) {
      classification = 'NEEDS_VERIFICATION';
      notes.push(`TibiaMonk sugere ${monkCategory}, mas TibiaWiki Bosstiário não listou — requer verificação manual.`);
    }
  }

  return {
    name: officialName,
    slug: candidate.slug,
    candidateName: candidate.name,
    classification,
    bosstiaryCategory,
    sources,
    evidence,
    aliases: notes,
    sourceUrl: candidate.sourceUrl,
  };
}

function validateOutputs(audit, confirmed, pending) {
  const errors = [];
  const slugs = audit.map((row) => row.slug);
  if (new Set(slugs).size !== slugs.length) errors.push('Slugs duplicados no audit.');
  for (const row of audit) {
    if (!CLASSIFICATIONS.includes(row.classification)) errors.push(`Sem classificação: ${row.slug}`);
  }
  for (const row of confirmed) {
    if (row.classification === 'NEEDS_VERIFICATION' || row.classification === 'NOT_IN_BOSSTIARY') {
      errors.push(`Confirmado inválido: ${row.slug}`);
    }
  }
  for (const row of pending) {
    if (row.classification !== 'NEEDS_VERIFICATION') errors.push(`Pending inválido: ${row.slug}`);
  }
  return errors;
}

function validateRunecodexCompare(compare, targets) {
  const errors = [];
  if (compare.allTwenty.length !== targets.length) {
    errors.push(`Comparação incompleta: ${compare.allTwenty.length} de ${targets.length} targets.`);
  }
  const missing = targets.filter((slug) => !compare.allTwenty.some((row) => row.runecodexSlug === slug));
  if (missing.length) errors.push(`Targets não comparados: ${missing.join(', ')}`);
  return errors;
}

function resolveWikiForRunecodexSlug(runecodexSlug, wikiOfficial, aliases) {
  const aliasNames = aliases[runecodexSlug];
  if (aliasNames?.length) {
    for (const aliasName of aliasNames) {
      const hit = wikiOfficial.byName.get(normalizeName(aliasName));
      if (hit) return { wiki: hit, via: `alias:${aliasName}` };
    }
  }
  const bySlug = wikiOfficial.bySlug.get(runecodexSlug);
  if (bySlug) return { wiki: bySlug, via: 'slug' };
  return { wiki: null, via: null };
}

function assessRunecodexTargets(targets, wikiOfficial, audit, aliases) {
  const auditBySlug = new Map(audit.map((row) => [row.slug, row]));
  const confirmedWikiSlugs = new Set(
    audit.filter((r) => r.classification.startsWith('CONFIRMED_')).map((r) => r.slug),
  );

  const targetRows = targets.map((runecodexSlug) => {
    const candidateRow = auditBySlug.get(runecodexSlug) ?? null;
    const { wiki, via } = resolveWikiForRunecodexSlug(runecodexSlug, wikiOfficial, aliases);
    let status;
    let classification = null;
    let bosstiaryCategory = null;
    let officialName = null;

    if (wiki) {
      classification = classificationFromCategory(wiki.category);
      bosstiaryCategory = wiki.category.charAt(0) + wiki.category.slice(1).toLowerCase();
      officialName = wiki.name;
      status = 'CONFIRMED_BOSSTIARY';
    } else if (candidateRow?.classification.startsWith('CONFIRMED_')) {
      classification = candidateRow.classification;
      bosstiaryCategory = candidateRow.bosstiaryCategory;
      officialName = candidateRow.name;
      status = 'CONFIRMED_BOSSTIARY';
    } else if (candidateRow?.classification === 'NEEDS_VERIFICATION') {
      classification = candidateRow.classification;
      status = 'NEEDS_VERIFICATION';
      officialName = candidateRow.name;
    } else if (candidateRow?.classification === 'NOT_IN_BOSSTIARY') {
      classification = candidateRow.classification;
      status = 'NOT_IN_BOSSTIARY';
      officialName = candidateRow.name;
    } else {
      status = 'NOT_IN_BOSSTIARY';
      classification = 'NOT_IN_BOSSTIARY';
      officialName = null;
    }

    return {
      runecodexSlug,
      status,
      classification,
      bosstiaryCategory,
      officialWikiName: officialName,
      candidateInExtracted: Boolean(candidateRow),
      matchedVia: via,
      aliases: aliases[runecodexSlug] ?? [],
    };
  });

  const registeredConfirmed = targetRows.filter((row) => row.status === 'CONFIRMED_BOSSTIARY');
  const registeredUnconfirmed = targetRows.filter(
    (row) => row.status === 'NOT_IN_BOSSTIARY' || row.status === 'NEEDS_VERIFICATION',
  );
  const notInCandidates = targetRows.filter((row) => !row.candidateInExtracted);

  const targetSet = new Set(targets);
  const registeredWikiSlugSet = new Set(
    targetRows
      .filter((row) => row.status === 'CONFIRMED_BOSSTIARY')
      .map((row) => {
        const name = row.officialWikiName;
        if (!name) return null;
        const hit = audit.find(
          (r) => r.name.toLowerCase() === name.toLowerCase() && r.classification.startsWith('CONFIRMED_'),
        );
        return hit?.slug ?? null;
      })
      .filter(Boolean),
  );
  const confirmedMissingInRune = [...confirmedWikiSlugs].filter((slug) => !registeredWikiSlugSet.has(slug));

  return {
    allTwenty: targetRows,
    registeredConfirmed: registeredConfirmed.map((row) => row.runecodexSlug),
    registeredUnconfirmed: registeredUnconfirmed.map((row) => row.runecodexSlug),
    notInCandidates: notInCandidates.map((row) => row.runecodexSlug),
    confirmedMissingInRune,
    newConfirmedBeyondTwenty: confirmedMissingInRune.length,
    notInBosstiaryCount: audit.filter((r) => r.classification === 'NOT_IN_BOSSTIARY').length,
    pendingCount: audit.filter((r) => r.classification === 'NEEDS_VERIFICATION').length,
  };
}

function miniBossReport(records) {
  return MINI_BOSSES.map((label) => {
    const slug = slugify(label);
    const hit =
      records.find((row) => row.slug === slug) ??
      records.find((row) => normalizeName(row.name) === normalizeName(label));
    return {
      name: label,
      slug,
      classification: hit?.classification ?? 'NOT_FOUND_IN_CANDIDATES',
      bosstiaryCategory: hit?.bosstiaryCategory ?? null,
      notes: hit?.aliases ?? [],
    };
  });
}

function markdownReport(ctx) {
  const lines = [];
  lines.push('# Auditoria do catálogo oficial do Bosstiary');
  lines.push('');
  lines.push(`Data: ${ctx.generatedAt}`);
  lines.push('');
  lines.push('## Fontes');
  lines.push(`- TibiaWiki Bosstiário: ${WIKI_BOSSTIARY_URL}`);
  lines.push(`- TibiaWiki Categoria Bosses (somente candidatos): ${WIKI_CATEGORY_BOSSES_URL}`);
  lines.push(`- Tibia Monk Bosstiary: ${MONK_URL}`);
  lines.push('');
  lines.push('## Totais TibiaWiki (API categorymembers)');
  lines.push(`- Bane: ${ctx.wiki.totals.BANE}`);
  lines.push(`- Archfoe: ${ctx.wiki.totals.ARCHFOE}`);
  lines.push(`- Nemesis: ${ctx.wiki.totals.NEMESIS}`);
  lines.push(`- **Total oficial listado:** ${ctx.wiki.totals.BANE + ctx.wiki.totals.ARCHFOE + ctx.wiki.totals.NEMESIS}`);
  lines.push('');
  lines.push('## Candidatos RuneCodex (`bosses-extracted.json`)');
  lines.push(`- Analisados: **${ctx.totals.analyzed}**`);
  lines.push(`- Confirmados Bane: **${ctx.totals.confirmedBane}**`);
  lines.push(`- Confirmados Archfoe: **${ctx.totals.confirmedArchfoe}**`);
  lines.push(`- Confirmados Nemesis: **${ctx.totals.confirmedNemesis}**`);
  lines.push(`- Não pertencem ao Bosstiary: **${ctx.totals.notInBosstiary}**`);
  lines.push(`- Pendentes de verificação: **${ctx.totals.pending}**`);
  lines.push('');
  lines.push('## RuneCodex (20 registros atuais)');
  lines.push(`- Confirmados já cadastrados: **${ctx.compare.registeredConfirmed.length}** / 20`);
  lines.push(`- Cadastrados sem confirmação no Bosstiary: **${ctx.compare.registeredUnconfirmed.length}**`);
  for (const row of ctx.compare.allTwenty.filter((r) => r.status !== 'CONFIRMED_BOSSTIARY')) {
    const aliasNote = row.aliases.length ? ` (wiki: ${row.aliases.join(', ')})` : '';
    lines.push(`  - \`${row.runecodexSlug}\` → ${row.classification ?? row.status}${aliasNote}`);
  }
  lines.push(`- Novos bosses confirmados (fora dos 20 atuais): **${ctx.compare.newConfirmedBeyondTwenty}**`);
  if (ctx.compare.notInCandidates.length) {
    lines.push(`- Slugs só no Neon / não estão em \`bosses-extracted.json\`: ${ctx.compare.notInCandidates.join(', ')}`);
  }
  lines.push('');
  lines.push('### Mapa dos 20 slugs');
  for (const row of ctx.compare.allTwenty) {
    const cat = row.bosstiaryCategory ? ` (${row.bosstiaryCategory})` : '';
    const wiki = row.officialWikiName ? ` — wiki: ${row.officialWikiName}` : '';
    lines.push(`- \`${row.runecodexSlug}\` → ${row.status}${cat}${wiki}`);
  }
  lines.push('');
  lines.push('## Mini-bosses investigados');
  for (const row of ctx.miniBosses) {
    lines.push(`- **${row.name}** → ${row.classification}${row.bosstiaryCategory ? ` (${row.bosstiaryCategory})` : ''}`);
  }
  lines.push('');
  if (ctx.wiki.divergences.length) {
    lines.push('## Divergências TibiaWiki (categorias sobrepostas)');
    for (const d of ctx.wiki.divergences) lines.push(`- ${d.name}: ${d.categories.join(' vs ')}`);
    lines.push('');
  }
  if (ctx.monk.note) {
    lines.push(`## Limitação TibiaMonk`);
    lines.push(`- ${ctx.monk.note}`);
    lines.push(`- Totais parseados: Bane ${ctx.monk.totals?.BANE ?? 0}, Archfoe ${ctx.monk.totals?.ARCHFOE ?? 0}, Nemesis ${ctx.monk.totals?.NEMESIS ?? 0}`);
    lines.push('');
  }
  lines.push('## Limitações');
  lines.push('- A auditoria usa a **união das categorias** `Bosses Bane/Archfoe/Nemesis` da TibiaWiki BR como prova de entrada no Bosstiary.');
  lines.push('- Candidatos da categoria geral **Categoria:Bosses** sem essas tags são **NOT_IN_BOSSTIARY**.');
  lines.push('- TibiaMonk foi usado como contraste; divergências viram **NEEDS_VERIFICATION**.');
  lines.push('- Não houve alteração no banco Neon nem novos cadastros.');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const candidates = JSON.parse(readFileSync(path.join(REPO, 'scripts/bosses-extracted.json'), 'utf8'));
  const targets = JSON.parse(readFileSync(path.join(REPO, 'scripts/bosstiary-enrichment-targets.json'), 'utf8'));
  const aliases = JSON.parse(readFileSync(path.join(REPO, 'scripts/bosstiary-wiki-aliases.json'), 'utf8'));

  const wikiOfficial = await loadOfficialWikiBosses();
  const monk = await loadMonkBosses();
  const monkSets = monkSlugSets(monk);

  const audit = candidates.map((candidate) => buildRecord(candidate, wikiOfficial, monkSets, monk));

  const confirmed = audit.filter((row) => row.classification.startsWith('CONFIRMED_'));
  const pending = audit.filter((row) => row.classification === 'NEEDS_VERIFICATION');

  const totals = {
    analyzed: audit.length,
    confirmedBane: audit.filter((r) => r.classification === 'CONFIRMED_BANE').length,
    confirmedArchfoe: audit.filter((r) => r.classification === 'CONFIRMED_ARCHFOE').length,
    confirmedNemesis: audit.filter((r) => r.classification === 'CONFIRMED_NEMESIS').length,
    notInBosstiary: audit.filter((r) => r.classification === 'NOT_IN_BOSSTIARY').length,
    pending: pending.length,
  };

  const compare = assessRunecodexTargets(targets, wikiOfficial, audit, aliases);
  const miniBosses = miniBossReport(audit);
  const generatedAt = new Date().toISOString();

  let validationErrors = validateOutputs(audit, confirmed, pending);
  validationErrors = [...validationErrors, ...validateRunecodexCompare(compare, targets)];

  const auditPayload = {
    generatedAt,
    sources: {
      tibiaWikiBosstiary: WIKI_BOSSTIARY_URL,
      tibiaWikiBossesCategory: WIKI_CATEGORY_BOSSES_URL,
      tibiaMonk: MONK_URL,
    },
    wikiOfficialTotals: wikiOfficial.totals,
    monkTotals: monk.totals ?? null,
    runecodexTargets: targets,
    totals,
    compare,
    wikiCategoryDivergences: wikiOfficial.divergences,
    miniBosses,
    validationErrors,
    entries: audit,
  };

  writeFileSync(path.join(REPO, 'scripts/bosstiary-catalog-audit.json'), `${JSON.stringify(auditPayload, null, 2)}\n`);
  writeFileSync(path.join(REPO, 'scripts/bosstiary-catalog-confirmed.json'), `${JSON.stringify({ generatedAt, count: confirmed.length, bosses: confirmed }, null, 2)}\n`);
  writeFileSync(path.join(REPO, 'scripts/bosstiary-catalog-pending.json'), `${JSON.stringify({ generatedAt, count: pending.length, bosses: pending }, null, 2)}\n`);
  writeFileSync(
    path.join(REPO, 'scripts/bosstiary-catalog-audit.md'),
    markdownReport({ generatedAt, wiki: wikiOfficial, monk, totals, compare, miniBosses }),
  );

  console.log(JSON.stringify({ totals, compare, validationErrors, miniBosses }, null, 2));
  if (validationErrors.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
