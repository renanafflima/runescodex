/**
 * Final Bosstiary catalog validation (read-only, no DB).
 * Usage: node scripts/validate-bosstiary-catalog-final.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');

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

function wikiUrl(title) {
  return `https://www.tibiawiki.com.br/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

function loadJson(rel) {
  const raw = readFileSync(path.join(REPO, rel), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function buildWikiUnionFromTmp() {
  const tmpPath = path.join(REPO, 'scripts/.tmp-official-bosstiary-wiki.json');
  if (!existsSync(tmpPath)) return null;
  const raw = JSON.parse(readFileSync(tmpPath, 'utf8'));
  const byTitle = new Map();
  for (const [category, titles] of Object.entries(raw)) {
    for (const title of titles) {
      byTitle.set(title, category);
    }
  }
  return {
    totals: {
      BANE: raw.BANE.length,
      ARCHFOE: raw.ARCHFOE.length,
      NEMESIS: raw.NEMESIS.length,
      sum: raw.BANE.length + raw.ARCHFOE.length + raw.NEMESIS.length,
      uniqueTitles: byTitle.size,
    },
    byTitle,
  };
}

function wikiSlugsCoveredByRunecodex(targets, aliases, confirmedByName) {
  const wikiSlugs = new Set();
  for (const runecodexSlug of targets) {
    const aliasNames = aliases[runecodexSlug];
    if (aliasNames?.length) {
      for (const name of aliasNames) {
        const hit = confirmedByName.get(name.toLowerCase());
        if (hit) wikiSlugs.add(hit.slug);
      }
      continue;
    }
    const hit = [...confirmedByName.values()].find((row) => row.slug === runecodexSlug);
    if (hit) wikiSlugs.add(hit.slug);
  }
  return wikiSlugs;
}

function main() {
  const audit = loadJson('scripts/bosstiary-catalog-audit.json');
  const confirmedPayload = loadJson('scripts/bosstiary-catalog-confirmed.json');
  const pendingPayload = loadJson('scripts/bosstiary-catalog-pending.json');
  const aliases = loadJson('scripts/bosstiary-wiki-aliases.json');
  const targets = loadJson('scripts/bosstiary-enrichment-targets.json');
  const enrichment = loadJson('scripts/bosstiary-enrichment-status.json');
  const candidates = loadJson('scripts/bosses-extracted.json');

  const confirmed = confirmedPayload.bosses;
  const confirmedBySlug = new Map(confirmed.map((row) => [row.slug, row]));
  const confirmedByName = new Map(confirmed.map((row) => [row.name.toLowerCase(), row]));
  const targetSet = new Set(targets);

  const auditReportedNew = audit.compare?.newConfirmedBeyondTwenty ?? null;
  const missingByTargetSlugOnly = confirmed
    .map((row) => row.slug)
    .filter((slug) => !targetSet.has(slug));

  const registeredWikiSlugs = wikiSlugsCoveredByRunecodex(
    targets.filter((slug) => {
      const row = audit.compare?.allTwenty?.find((r) => r.runecodexSlug === slug);
      return row?.status === 'CONFIRMED_BOSSTIARY';
    }),
    aliases,
    confirmedByName,
  );

  const registeredUnconfirmedLegacy = targets.filter((slug) => {
    const row = audit.compare?.allTwenty?.find((r) => r.runecodexSlug === slug);
    return row && row.status !== 'CONFIRMED_BOSSTIARY';
  });

  const newValidBosses = confirmed.filter((row) => !registeredWikiSlugs.has(row.slug));
  const fourGhostSlugs = missingByTargetSlugOnly.filter((slug) => registeredWikiSlugs.has(slug));

  const wikiUnion = buildWikiUnionFromTmp();
  const wikiOfficialNotInConfirmed = [];
  if (wikiUnion) {
    for (const [title, category] of wikiUnion.byTitle) {
      if (!confirmedByName.has(title.toLowerCase())) {
        wikiOfficialNotInConfirmed.push({
          officialWikiName: title,
          proposedWikiSlug: slugify(title),
          bosstiaryCategory: category.charAt(0) + category.slice(1).toLowerCase(),
          sourceUrl: wikiUrl(title),
          reason:
            title === "Tentugly's Head"
              ? 'Candidato em bosses-extracted.json com nome de template MediaWiki, não casou com a lista oficial.'
              : 'Ausente de bosses-extracted.json; não passou pela auditoria de candidatos.',
        });
      }
    }
  }

  const slugMismatches = confirmed
    .filter((row) => slugify(row.name) !== row.slug)
    .map((row) => ({
      name: row.name,
      auditSlug: row.slug,
      slugFromName: slugify(row.name),
      note: 'Slug do audit segue bosses-extracted.json; diverge do slugify(nome wiki).',
    }));

  const enrichmentBySlug = new Map(enrichment.bosses.map((row) => [row.slug, row]));

  const twentyValidation = targets.map((runecodexSlug) => {
    const dbName = enrichmentBySlug.get(runecodexSlug)?.name ?? null;
    const compareRow = audit.compare?.allTwenty?.find((r) => r.runecodexSlug === runecodexSlug) ?? null;
    const aliasList = aliases[runecodexSlug] ?? [];
    const isLegacyUnconfirmed = registeredUnconfirmedLegacy.includes(runecodexSlug);
    const wikiSlug =
      compareRow?.status === 'CONFIRMED_BOSSTIARY'
        ? confirmedByName.get((compareRow.officialWikiName ?? '').toLowerCase())?.slug ?? null
        : null;

    let matchCertainty = 'inequívoca';
    const notes = [];
    if (aliasList.length) notes.push(`Alias explícito: ${aliasList.join(' → ')}`);
    if (dbName && compareRow?.officialWikiName && dbName !== compareRow.officialWikiName) {
      notes.push(`Nome Neon "${dbName}" difere do título wiki "${compareRow.officialWikiName}" (slug preservado).`);
      if (aliasList.length) matchCertainty = 'inequívoca via alias';
      else matchCertainty = 'ambiguidade de nomenclatura interna';
    }
    if (isLegacyUnconfirmed) {
      matchCertainty = 'legacy — sem entrada Bosstiary';
      notes.push('Registro legacy; não desativar nesta etapa.');
    }

    return {
      runecodexSlug,
      registeredName: dbName,
      officialWikiName: compareRow?.officialWikiName ?? null,
      wikiSlug,
      aliases: aliasList,
      bosstiaryCategory: compareRow?.bosstiaryCategory ?? null,
      status: compareRow?.status ?? 'UNKNOWN',
      matchCertainty,
      notes,
    };
  });

  const newBossRows = newValidBosses.map((row) => ({
    officialWikiName: row.name,
    wikiSlug: row.slug,
    bosstiaryCategory: row.bosstiaryCategory,
    sourceUrl: row.sources?.find((s) => s.url.includes('/wiki/') && !s.url.includes('Bossti'))?.url ?? row.sourceUrl,
    proposedInternalSlug: row.slug,
    duplicateOfExistingTwenty: targetSet.has(row.slug),
    candidateSourceUrl: row.sourceUrl,
  }));

  const duplicateAmongNew = newBossRows.filter((row) => row.duplicateOfExistingTwenty);

  const reconciliation = {
    confirmedFromCandidateAudit: confirmed.length,
    runecodexTargetsTotal: targets.length,
    runecodexConfirmedBosstiaryIdentities: registeredWikiSlugs.size,
    runecodexLegacyNotInBosstiary: registeredUnconfirmedLegacy.length,
    newValidExpansionBosses: newValidBosses.length,
    expectedNewBySubtraction: confirmed.length - registeredWikiSlugs.size,
    auditReportedNewBeyondTwenty: auditReportedNew,
    auditMetricGap: auditReportedNew - newValidBosses.length,
    fourSlugsInflatingAuditMetric: fourGhostSlugs.map((wikiSlug) => {
      const boss = confirmedBySlug.get(wikiSlug);
      const runecodexSlug = Object.entries(aliases).find(([, names]) =>
        names.some((n) => n.toLowerCase() === boss?.name?.toLowerCase()),
      )?.[0];
      return {
        wikiSlug,
        officialWikiName: boss?.name ?? null,
        runecodexSlug: runecodexSlug ?? null,
        explanation:
          'Contado em newConfirmedBeyondTwenty porque o slug wiki não está em bosstiary-enrichment-targets.json, embora o boss já esteja no Neon sob slug interno diferente.',
      };
    }),
    formula: '314 confirmados − 17 identidades wiki já no Neon = 297 novos; 301 − 4 slugs fantasmas de alias = 297.',
  };

  const categoryOverlap = [];
  if (wikiUnion && wikiUnion.totals.sum !== wikiUnion.totals.uniqueTitles) {
    categoryOverlap.push({
      type: 'multi_category_same_title',
      note: 'Título listado em mais de uma categoria Bosstiary.',
    });
  }

  const wiki316vs314 = {
    wikiCategoryMemberSum: audit.wikiOfficialTotals
      ? audit.wikiOfficialTotals.BANE +
        audit.wikiOfficialTotals.ARCHFOE +
        audit.wikiOfficialTotals.NEMESIS
      : wikiUnion?.totals.sum,
    wikiUniqueTitles: wikiUnion?.totals.uniqueTitles ?? null,
    confirmedClassifiedAmongCandidates: confirmed.length,
    differenceExplainedAs: wikiOfficialNotInConfirmed.length
      ? `${wikiOfficialNotInConfirmed.length} título(s) oficiais da Wiki não classificados entre os 538 candidatos (não é sobreposição de categorias).`
      : 'Verificar snapshot wiki.',
    titlesOfficialButNotInConfirmedAudit: wikiOfficialNotInConfirmed,
    categoryOverlapDetected: categoryOverlap,
  };

  const errors = [];
  if (reconciliation.expectedNewBySubtraction !== reconciliation.newValidExpansionBosses) {
    errors.push('Inconsistência interna ao calcular novos bosses.');
  }
  if (reconciliation.auditMetricGap !== 4) {
    errors.push(`Esperado gap 4 entre métrica audit e reconciliada; obtido ${reconciliation.auditMetricGap}.`);
  }
  if (duplicateAmongNew.length) {
    errors.push(`Novos bosses marcados com slug já presente nos 20: ${duplicateAmongNew.map((r) => r.wikiSlug).join(', ')}`);
  }
  const confirmedSlugs = confirmed.map((r) => r.slug);
  if (new Set(confirmedSlugs).size !== confirmedSlugs.length) errors.push('Slugs duplicados em confirmed.');
  if (pendingPayload.count > 0) errors.push('Pending não vazio; revisar antes de expandir.');

  const payload = {
    generatedAt: new Date().toISOString(),
    inputs: [
      'scripts/bosstiary-catalog-audit.json',
      'scripts/bosstiary-catalog-confirmed.json',
      'scripts/bosstiary-catalog-pending.json',
      'scripts/bosstiary-wiki-aliases.json',
      'scripts/bosses-extracted.json',
      'scripts/bosstiary-enrichment-targets.json',
      'scripts/bosstiary-enrichment-status.json',
      'scripts/.tmp-official-bosstiary-wiki.json',
    ],
    reconciliation,
    wiki316vs314,
    currentTwenty: twentyValidation,
    legacyPreserved: registeredUnconfirmedLegacy.map((slug) => ({
      runecodexSlug: slug,
      note: 'Legacy não confirmado no Bosstiary; registro preservado.',
    })),
    newValidBosses: {
      count: newBossRows.length,
      bosses: newBossRows,
    },
    duplicates: {
      amongNewVsTwenty: duplicateAmongNew,
      confirmedSlugDuplicates: [],
    },
    aliasesConfirmed: aliases,
    ambiguities: [
      ...slugMismatches,
      ...wikiOfficialNotInConfirmed.map((row) => ({
        type: 'wiki_official_missing_from_314',
        ...row,
      })),
      {
        type: 'audit_metric_definition',
        detail:
          'compare.newConfirmedBeyondTwenty compara slugs dos 20 targets com slugs wiki dos confirmados, ignorando aliases — gera 301 em vez de 297.',
      },
      {
        type: 'tentugly_candidate_corruption',
        candidate: candidates.find((c) => c.sourceUrl?.includes('Tentugly')) ?? null,
      },
    ],
    candidateStats: {
      extractedCount: candidates.length,
      notInBosstiary: audit.totals?.notInBosstiary ?? null,
    },
    errors,
    validationPassed: errors.length === 0,
  };

  const md = buildMarkdown(payload);
  writeFileSync(path.join(REPO, 'scripts/bosstiary-catalog-final-validation.json'), `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(path.join(REPO, 'scripts/bosstiary-catalog-final-validation.md'), md);
  console.log(JSON.stringify({ validationPassed: payload.validationPassed, reconciliation, errors }, null, 2));
}

function buildMarkdown(ctx) {
  const lines = [];
  lines.push('# Validação final — catálogo Bosstiary');
  lines.push('');
  lines.push(`Data: ${ctx.generatedAt}`);
  lines.push('');
  lines.push('## Reconciliação de contagens');
  lines.push('');
  lines.push('| Métrica | Valor |');
  lines.push('|---------|------:|');
  lines.push(`| Confirmados na auditoria (candidatos) | **${ctx.reconciliation.confirmedFromCandidateAudit}** |`);
  lines.push(`| Já no Neon com Bosstiary comprovado | **${ctx.reconciliation.runecodexConfirmedBosstiaryIdentities}** / 20 |`);
  lines.push(`| Legacy sem Bosstiary (preservados) | **${ctx.reconciliation.runecodexLegacyNotInBosstiary}** |`);
  lines.push(`| **Novos bosses válidos para expansão** | **${ctx.reconciliation.newValidExpansionBosses}** |`);
  lines.push(
    `| Métrica antiga newConfirmedBeyondTwenty | **${ctx.reconciliation.auditReportedNewBeyondTwenty}** |`,
  );
  lines.push(`| Diferença explicada | **${ctx.reconciliation.auditMetricGap}** (aliases de slug) |`);
  lines.push('');
  lines.push(ctx.reconciliation.formula);
  lines.push('');
  lines.push('### Os 4 slugs que inflam 301 → 297');
  for (const row of ctx.reconciliation.fourSlugsInflatingAuditMetric) {
    lines.push(
      `- **${row.wikiSlug}** (${row.officialWikiName}) → Neon: \`${row.runecodexSlug}\``,
    );
  }
  lines.push('');
  lines.push('## 316 títulos wiki vs 314 confirmados');
  lines.push('');
  lines.push(`- Soma API Bane+Archfoe+Nemesis: **${ctx.wiki316vs314.wikiCategoryMemberSum}**`);
  lines.push(`- Títulos únicos (união): **${ctx.wiki316vs314.wikiUniqueTitles}**`);
  lines.push(`- Confirmados entre candidatos: **${ctx.wiki316vs314.confirmedClassifiedAmongCandidates}**`);
  lines.push(`- Explicação: ${ctx.wiki316vs314.differenceExplainedAs}`);
  if (ctx.wiki316vs314.titlesOfficialButNotInConfirmedAudit.length) {
    lines.push('');
    lines.push('Títulos oficiais ausentes dos 314:');
    for (const row of ctx.wiki316vs314.titlesOfficialButNotInConfirmedAudit) {
      lines.push(`- **${row.officialWikiName}** (${row.bosstiaryCategory}) — ${row.reason}`);
    }
  }
  lines.push('');
  lines.push('## 20 registros atuais');
  lines.push('');
  for (const row of ctx.currentTwenty) {
    const cat = row.bosstiaryCategory ? ` [${row.bosstiaryCategory}]` : '';
    lines.push(
      `- \`${row.runecodexSlug}\` — ${row.status}${cat} — wiki: ${row.officialWikiName ?? '—'} — certeza: ${row.matchCertainty}`,
    );
    if (row.notes.length) lines.push(`  - ${row.notes.join(' | ')}`);
  }
  lines.push('');
  lines.push('## Legacy preservado (3)');
  for (const row of ctx.legacyPreserved) {
    lines.push(`- \`${row.runecodexSlug}\`: ${row.note}`);
  }
  lines.push('');
  lines.push('## Novos bosses válidos');
  lines.push('');
  lines.push(`Total: **${ctx.newValidBosses.count}** (lista completa em \`bosstiary-catalog-final-validation.json\`).`);
  lines.push('');
  if (ctx.ambiguities.length) {
    lines.push('## Ambiguidades e ressalvas');
    for (const amb of ctx.ambiguities.filter((a) => a.type)) {
      if (amb.type === 'wiki_official_missing_from_314') {
        lines.push(`- Wiki oficial sem entrada nos 314: **${amb.officialWikiName}**`);
      } else if (amb.type === 'audit_metric_definition') {
        lines.push(`- Métrica do audit: ${amb.detail}`);
      } else if (amb.type === 'tentugly_candidate_corruption') {
        lines.push(`- Candidato Tentugly corrompido: slug \`${amb.candidate?.slug}\``);
      }
    }
    if (ctx.ambiguities.some((a) => a.auditSlug)) {
      lines.push('');
      lines.push('Slugs (Criatura) divergentes do slugify do nome:');
      for (const row of ctx.ambiguities.filter((a) => a.auditSlug)) {
        lines.push(`- ${row.name}: \`${row.auditSlug}\` vs \`${row.slugFromName}\``);
      }
    }
  }
  lines.push('');
  lines.push('## Erros de validação');
  lines.push(ctx.errors.length ? ctx.errors.map((e) => `- ${e}`).join('\n') : '- Nenhum.');
  lines.push('');
  lines.push('## Restrições respeitadas');
  lines.push('- Sem Neon, migrations, sync, commit ou alteração dos 20 registros/candidatos originais.');
  return `${lines.join('\n')}\n`;
}

main();
