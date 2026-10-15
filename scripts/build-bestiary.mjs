/**
 * Collect TibiaWiki bestiary facts for existing Creature rows.
 * Reads the database and writes review files. It does not insert,
 * update, or delete.
 *
 * Usage (from the repository root):
 *   node scripts/build-bestiary.mjs
 */
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildBestiaryFacts,
  normalizeLookupName,
  parseInfoboxFields,
  renderBestiarySql,
  validateBestiarySql,
} from "./bestiary-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "apps/api/package.json"));
const { Client } = require("pg");

const WIKI_API = "https://www.tibiawiki.com.br/api.php";
const USER_AGENT = "RuneCodexBestiary/1.0 (local catalog import; read-only)";
const OUTPUT_DIR = path.join(root, "scripts");

async function main() {
  const creatures = await loadCreatures();
  const existingEntries = await loadExistingEntries();
  const pages = await fetchCreaturePages(creatures.map((creature) => creature.name));
  const pagesByName = new Map(pages.map((page) => [normalizeLookupName(page.requested), page]));

  const unmatched = [];
  const doubtful = [];
  const extracted = [];
  const sqlRows = [];

  for (const creature of creatures) {
    const page = pagesByName.get(normalizeLookupName(creature.name));
    if (!page || page.missing) {
      unmatched.push({
        name: creature.name,
        slug: creature.slug,
        reason: "Página não encontrada no TibiaWiki",
      });
      continue;
    }
    if (page.redirectedTo && normalizeLookupName(page.redirectedTo) !== normalizeLookupName(creature.name)) {
      doubtful.push({
        name: creature.name,
        slug: creature.slug,
        redirectedTo: page.redirectedTo,
        reason: "O título resolvido no TibiaWiki é diferente do nome em Creature",
      });
      continue;
    }
    const facts = buildBestiaryFacts(parseInfoboxFields(page.wikitext || ""));
    if (!facts) {
      unmatched.push({
        name: creature.name,
        slug: creature.slug,
        reason: "A página não tem Infobox_Criatura",
      });
      continue;
    }
    extracted.push({
      creatureId: creature.id,
      name: creature.name,
      slug: creature.slug,
      ...facts,
      hasBestiaryEntry: existingEntries.has(creature.id),
    });
    if (facts.killsRequired !== null && !existingEntries.has(creature.id)) {
      sqlRows.push({
        creatureId: creature.id,
        slug: creature.slug,
        category: facts.category,
        killsRequired: facts.killsRequired,
        charmPoints: facts.charmPoints,
        notes: facts.notes,
      });
    }
  }

  sqlRows.sort((left, right) => left.slug.localeCompare(right.slug, "en"));
  const sql = renderBestiarySql(sqlRows);
  const errors = validateBestiarySql({
    rows: sqlRows,
    sql,
    knownSlugs: new Set(creatures.map((creature) => creature.slug)),
    existingCreatureIds: existingEntries,
  });
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  const found = extracted.length;
  const withKills = extracted.filter((item) => item.killsRequired !== null);
  const withCategory = extracted.filter((item) => item.category);
  const withCharm = extracted.filter((item) => item.charmPoints !== null);
  const withNotes = extracted.filter((item) => item.notes);
  const already = extracted
    .filter((item) => item.hasBestiaryEntry)
    .map((item) => ({ name: item.name, slug: item.slug, creatureId: item.creatureId }));
  const missingFromExtraction = creatures.length - found - unmatched.length - doubtful.length;

  const report = {
    fonte: "https://www.tibiawiki.com.br/wiki/Criaturas",
    tabela: "Predefinição:Tabela Bestiário",
    totalCriaturasAnalisadas: creatures.length,
    totalEncontradasNoTibiaWiki: found,
    totalNaoEncontradas: unmatched.length,
    totalCorrespondenciasDuvidosas: doubtful.length,
    totalComBestiaryEntryExistente: already.length,
    totalNovasBestiaryEntry: sqlRows.length,
    totalComKillsRequired: withKills.length,
    totalSemKillsRequired: creatures.length - withKills.length,
    totalComCategory: withCategory.length,
    totalSemCategory: creatures.length - withCategory.length,
    totalComCharmPoints: withCharm.length,
    totalSemCharmPoints: creatures.length - withCharm.length,
    totalComEstimatedKillsPerHour: 0,
    totalSemEstimatedKillsPerHour: creatures.length,
    totalComNotes: withNotes.length,
    totalSemNotes: creatures.length - withNotes.length,
    criaturasNaoEncontradas: unmatched,
    criaturasComCorrespondenciaDuvidosa: doubtful,
    criaturasSemKillsRequired: creatures
      .filter((creature) => !withKills.some((item) => item.creatureId === creature.id))
      .map((creature) => ({ name: creature.name, slug: creature.slug })),
    criaturasSemCategory: creatures
      .filter((creature) => !withCategory.some((item) => item.creatureId === creature.id))
      .map((creature) => ({ name: creature.name, slug: creature.slug })),
    criaturasSemCharmPoints: creatures
      .filter((creature) => !withCharm.some((item) => item.creatureId === creature.id))
      .map((creature) => ({ name: creature.name, slug: creature.slug })),
    criaturasSemEstimatedKillsPerHour: creatures.map((creature) => ({
      name: creature.name,
      slug: creature.slug,
      reason: "O TibiaWiki não publica estimated kills per hour",
    })),
    dificuldadesTibiaWiki: countBy(extracted, (item) => item.difficultyRaw || "ausente"),
    dificuldadeNaoAtualizada: "Creature.difficulty não foi alterada. O TibiaWiki usa seis níveis e o enum do projeto tem EASY, MEDIUM, HARD e VERY_HARD.",
    conferencias: { paginasSemClassificacao: missingFromExtraction },
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(path.join(OUTPUT_DIR, "bestiary.sql"), sql);
  await writeFile(path.join(OUTPUT_DIR, "bestiary-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(OUTPUT_DIR, "bestiary-unmatched-creatures.json"), `${JSON.stringify(unmatched, null, 2)}\n`);
  await writeFile(path.join(OUTPUT_DIR, "bestiary-already-exists.json"), `${JSON.stringify(already, null, 2)}\n`);
  await writeFile(
    path.join(OUTPUT_DIR, "bestiary-extracted.json"),
    `${JSON.stringify(
      extracted.map((item) => ({
        name: item.name,
        slug: item.slug,
        category: item.category,
        killsRequired: item.killsRequired,
        charmPoints: item.charmPoints,
        charmSource: item.charmSource,
        difficulty: item.difficultyRaw,
        occurrence: item.occurrenceRaw,
        notes: item.notes,
        hasBestiaryEntry: item.hasBestiaryEntry,
      })),
      null,
      2,
    )}\n`,
  );

  console.log(
    JSON.stringify(
      {
        analyzed: report.totalCriaturasAnalisadas,
        found: report.totalEncontradasNoTibiaWiki,
        missing: report.totalNaoEncontradas,
        doubtful: report.totalCorrespondenciasDuvidosas,
        already: report.totalComBestiaryEntryExistente,
        inserts: report.totalNovasBestiaryEntry,
        kills: report.totalComKillsRequired,
        category: report.totalComCategory,
        charm: report.totalComCharmPoints,
        estimated: report.totalComEstimatedKillsPerHour,
      },
      null,
      2,
    ),
  );
}

function countBy(items, select) {
  const counts = {};
  for (const item of items) {
    const key = select(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

async function fetchCreaturePages(names) {
  const pages = [];
  const size = 40;
  for (let index = 0; index < names.length; index += size) {
    const batch = names.slice(index, index + size);
    const data = await wikiQuery({
      action: "query",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      titles: batch.join("|"),
      redirects: "1",
    });
    const redirects = new Map((data.query?.redirects ?? []).map((item) => [item.to, item.from]));
    const normalized = new Map((data.query?.normalized ?? []).map((item) => [item.to, item.from]));
    for (const page of Object.values(data.query?.pages ?? {})) {
      const title = page.title;
      const requested = redirects.get(title) || normalized.get(title) || title;
      const content = page.revisions?.[0]?.slots?.main?.["*"] ?? page.revisions?.[0]?.["*"] ?? "";
      pages.push({
        requested,
        title,
        missing: page.missing !== undefined,
        redirectedTo: redirects.has(title) ? title : null,
        wikitext: content,
      });
    }
    console.error(`Páginas lidas: ${Math.min(index + size, names.length)}/${names.length}`);
    await delay(80);
  }
  return pages;
}

async function wikiQuery(params) {
  let delayMs = 1000;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const response = await fetch(WIKI_API, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        "user-agent": USER_AGENT,
        accept: "application/json",
      },
      body: new URLSearchParams({ format: "json", maxlag: "5", ...params }),
    });
    if (response.status === 429 || response.status >= 500) {
      await delay(delayMs);
      delayMs *= 2;
      continue;
    }
    if (!response.ok) {
      throw new Error(`TibiaWiki respondeu ${response.status}`);
    }
    const data = await response.json();
    if (data.error?.code === "maxlag") {
      await delay(delayMs);
      delayMs *= 2;
      continue;
    }
    if (data.error) {
      throw new Error(`TibiaWiki: ${data.error.code ?? "erro"} ${data.error.info ?? ""}`.trim());
    }
    return data;
  }
  throw new Error("TibiaWiki não respondeu após várias tentativas.");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withReadOnlyClient(callback) {
  const env = await readFile(path.join(root, "apps/api/.env"), "utf8");
  const connectionString = env.match(/^DATABASE_URL="?([^"\r\n]+)"?/m)?.[1];
  if (!connectionString) {
    throw new Error("DATABASE_URL não está definido em apps/api/.env.");
  }
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const result = await callback(client);
    await client.query("ROLLBACK");
    return result;
  } finally {
    await client.end();
  }
}

async function loadCreatures() {
  return withReadOnlyClient(async (client) => {
    const result = await client.query(
      'SELECT "id", "name", "slug" FROM "Creature" ORDER BY "name"',
    );
    return result.rows;
  });
}

async function loadExistingEntries() {
  return withReadOnlyClient(async (client) => {
    const result = await client.query('SELECT "creatureId" FROM "BestiaryEntry"');
    return new Set(result.rows.map((row) => row.creatureId));
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
