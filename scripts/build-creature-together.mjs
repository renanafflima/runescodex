/**
 * Collect TibiaWiki hunting locations and prepare a review-only
 * CreatureTogether import. This script only reads Creature and
 * CreatureTogether. It does not insert, update, or delete.
 *
 * Usage (from the repository root):
 *   node scripts/build-creature-together.mjs
 */
import { createRequire } from "node:module";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assetsWithoutCreature,
  buildLocationCreatures,
  buildRelations,
  countExistingRelations,
  indexCreatures,
  indexImageAssets,
  matchCreatureName,
  planCreatureCatalog,
  renderCreatureInsertSql,
  renderCreatureTogetherSql,
  validateImport,
} from "./creature-together-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "apps/api/package.json"));
const { Client } = require("pg");

const WIKI_API = "https://www.tibiawiki.com.br/api.php";
const SOURCE_PAGE = "https://www.tibiawiki.com.br/wiki/Locais_de_Caça";
const USER_AGENT = "RuneCodexCreatureTogether/1.0 (local catalog import; read-only)";
const OUTPUT_DIR = path.join(root, "scripts");

const ASSET_DIR = path.join(root, "apps/mobile/assets/runescodex/creatures");

const output = {
  locations: path.join(OUTPUT_DIR, "creature-together-locations.json"),
  unmatched: path.join(OUTPUT_DIR, "unmatched-creatures.json"),
  withoutImage: path.join(OUTPUT_DIR, "creatures-without-image.json"),
  creaturesSql: path.join(OUTPUT_DIR, "creatures.sql"),
  sql: path.join(OUTPUT_DIR, "creature-together.sql"),
  report: path.join(OUTPUT_DIR, "creature-together-report.json"),
};

async function main() {
  const creatures = await loadCreatures();
  const existingPairs = await loadExistingPairs();
  const locations = process.argv.includes("--cached")
    ? await loadCachedLocations()
    : await collectHuntLocations();
  const assetFileNames = await readdir(ASSET_DIR);
  const assetIndex = indexImageAssets(assetFileNames);
  const wikiNames = locations.flatMap((location) => location.creatures);
  const plan = planCreatureCatalog({
    wikiNames,
    existingCreatures: creatures,
    assetIndex,
  });
  const catalogByName = new Map(plan.catalog.map((creature) => [creature.name, creature]));
  const existingByName = indexCreatures(creatures);
  const { relations } = buildRelations(locations, (wikiName) => {
    const creature = catalogByName.get(wikiName);
    if (creature) {
      return { creature, reason: null };
    }
    return matchCreatureName(wikiName, existingByName);
  });
  const { unmatched } = buildRelations(locations, (wikiName) => matchCreatureName(wikiName, existingByName));
  const sql = renderCreatureTogetherSql(relations);
  const creaturesSql = renderCreatureInsertSql(plan.toInsert);
  const knownCreatureIds = new Set(plan.catalog.map((creature) => creature.id));
  const knownSlugs = new Set(plan.catalog.map((creature) => creature.slug));
  const errors = validateImport({
    locations,
    relations,
    sql,
    knownCreatureIds,
    knownSlugs,
  });
  const creatureSqlCode = creaturesSql.replace(/--.*$/gm, "");
  if (/\bUPDATE\b/i.test(creatureSqlCode) || /\bDELETE\b/i.test(creatureSqlCode)) {
    errors.push("SQL de criaturas executa UPDATE ou DELETE.");
  }
  if (plan.toInsert.length > 0 && !creaturesSql.includes('ON CONFLICT ("slug") DO NOTHING')) {
    errors.push("SQL de criaturas não é idempotente.");
  }
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  const existing = countExistingRelations(relations, existingPairs);
  const foundNames = new Set(wikiNames);
  const matchedNames = new Set(
    [...foundNames].filter((name) => matchCreatureName(name, existingByName).creature),
  );
  const unmatchedNames = new Set(unmatched.map((item) => item.tibiawikiName));
  const existingWithImage = creatures.filter((creature) => {
    const fileName = String(creature.image || "").split("/").pop();
    return fileName && assetFileNames.includes(fileName);
  });
  const report = {
    totalLocaisAnalisados: locations.length,
    totalLocaisComCriaturas: locations.filter((location) => location.creatures.length > 0).length,
    totalCriaturasEncontradas: foundNames.size,
    totalCriaturasEncontradasNoRuneCodex: matchedNames.size,
    totalCriaturasNaoEncontradas: unmatchedNames.size,
    totalRelacoesUnicasGeradas: relations.length,
    totalRelacoesJaExistentes: existing,
    totalNovasRelacoes: relations.length - existing,
    criaturasJaCadastradasComImagem: existingWithImage.length,
    assetsExistentes: assetFileNames.length,
    criaturasComImagemEncontrada: plan.withImage.length,
    criaturasSemImagem: plan.withoutImage.length,
    assetsSemCriaturaCorrespondente: assetsWithoutCreature({
      assetIndex,
      creatureNames: foundNames,
      existingCreatures: creatures,
    }),
    possiveisDiferencasDeNomenclatura: plan.namingDifferences,
    criaturasNaoEncontradas: unmatched,
    locaisSemCriaturas: locations
      .filter((location) => location.creatures.length === 0)
      .map((location) => location.location),
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    output.locations,
    `${JSON.stringify({ source: SOURCE_PAGE, locations }, null, 2)}\n`,
  );
  await writeFile(output.unmatched, `${JSON.stringify(unmatched, null, 2)}\n`);
  await writeFile(output.withoutImage, `${JSON.stringify(plan.withoutImage, null, 2)}\n`);
  await writeFile(output.creaturesSql, creaturesSql);
  await writeFile(output.sql, sql);
  await writeFile(output.report, `${JSON.stringify(report, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        locations: report.totalLocaisAnalisados,
        creatures: report.totalCriaturasEncontradas,
        matched: report.totalCriaturasEncontradasNoRuneCodex,
        unmatched: report.totalCriaturasNaoEncontradas,
        relations: report.totalRelacoesUnicasGeradas,
        existing: report.totalRelacoesJaExistentes,
        withImage: report.criaturasComImagemEncontrada,
        withoutImage: report.criaturasSemImagem,
        assetsWithoutCreature: report.assetsSemCriaturaCorrespondente.length,
        namingDifferences: report.possiveisDiferencasDeNomenclatura.length,
        newCreatures: plan.toInsert.length,
        createdFiles: Object.values(output),
      },
      null,
      2,
    ),
  );
}

async function loadCachedLocations() {
  const cached = JSON.parse(await readFile(output.locations, "utf8"));
  return cached.locations;
}

async function collectHuntLocations() {
  const locationTitles = await listCategoryPageTitles("Category:Locais de Caça");
  console.error(`Locais de caça: ${locationTitles.length}`);
  const spawnCategoryNames = await listCategoryNames("Spawns/");
  console.error(`Categorias de spawn: ${spawnCategoryNames.length}`);
  const creaturePages = await listCreaturePages();
  console.error(`Páginas de criaturas: ${creaturePages.length}`);
  return buildLocationCreatures({
    locationTitles,
    spawnCategoryNames,
    creaturePages,
  });
}

async function listCategoryPageTitles(categoryTitle) {
  const titles = [];
  let continuation = {};
  do {
    const data = await wikiQuery({
      action: "query",
      list: "categorymembers",
      cmtitle: categoryTitle,
      cmtype: "page",
      cmlimit: "500",
      cmprop: "title",
      ...continuation,
    });
    for (const member of data.query?.categorymembers ?? []) {
      if (member.ns === 0 && member.title) {
        titles.push(member.title);
      }
    }
    continuation = data.continue;
  } while (continuation);
  return [...new Set(titles)];
}

async function listCategoryNames(prefix) {
  const names = [];
  let continuation = {};
  do {
    const data = await wikiQuery({
      action: "query",
      list: "allcategories",
      acprefix: prefix,
      aclimit: "500",
      ...continuation,
    });
    for (const category of data.query?.allcategories ?? []) {
      if (category["*"]) {
        names.push(category["*"]);
      }
    }
    continuation = data.continue;
  } while (continuation);
  return names;
}

async function listCreaturePages() {
  const byTitle = new Map();
  let continuation = {};
  let lastLogged = 0;
  do {
    const data = await wikiQuery({
      action: "query",
      generator: "categorymembers",
      gcmtitle: "Category:Criaturas",
      gcmtype: "page",
      gcmlimit: "40",
      prop: "info|categories",
      inprop: "redirect",
      cllimit: "max",
      ...continuation,
    });
    for (const page of Object.values(data.query?.pages ?? {})) {
      if (page.ns !== 0 || !page.title || page.missing !== undefined) {
        continue;
      }
      const current = byTitle.get(page.title) ?? {
        title: page.title,
        redirect: false,
        categories: [],
      };
      if (page.redirect !== undefined) {
        current.redirect = true;
      }
      for (const category of page.categories ?? []) {
        if (category.title) {
          current.categories.push(category.title);
        }
      }
      byTitle.set(page.title, current);
    }
    continuation = data.continue;
    if (byTitle.size - lastLogged >= 400) {
      lastLogged = byTitle.size;
      console.error(`Criaturas lidas: ${byTitle.size}`);
    }
  } while (continuation);

  return [...byTitle.values()].map((page) => ({
    ...page,
    categories: [...new Set(page.categories)],
  }));
}

async function wikiQuery(params) {
  const url = new URL(WIKI_API);
  url.search = new URLSearchParams({
    format: "json",
    maxlag: "5",
    ...params,
  });

  let delayMs = 1000;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "application/json",
      },
    });
    if (response.status === 429 || response.status >= 500) {
      await delay(delayMs);
      delayMs *= 2;
      continue;
    }
    if (!response.ok) {
      throw new Error(`TibiaWiki respondeu ${response.status} para ${url.pathname}`);
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
    await delay(80);
    return data;
  }
  throw new Error("TibiaWiki não respondeu após várias tentativas.");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withReadOnlyClient(callback) {
  const connectionString = await readDatabaseUrl();
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const result = await callback(client);
    await client.query("ROLLBACK");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The read-only transaction may already be closed.
    }
    throw error;
  } finally {
    await client.end();
  }
}

async function loadCreatures() {
  return withReadOnlyClient(async (client) => {
    const result = await client.query('SELECT "id", "name", "slug", "image" FROM "Creature"');
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      image: row.image,
    }));
  });
}

async function loadExistingPairs() {
  return withReadOnlyClient(async (client) => {
    const result = await client.query(
      'SELECT "creatureId", "relatedCreatureId" FROM "CreatureTogether"',
    );
    return new Set(result.rows.map((row) => `${row.creatureId}\0${row.relatedCreatureId}`));
  });
}

async function readDatabaseUrl() {
  const envPath = path.join(root, "apps/api/.env");
  const env = await readFile(envPath, "utf8");
  const match = env.match(/^DATABASE_URL="?([^"\r\n]+)"?/m);
  if (!match) {
    throw new Error("DATABASE_URL não está definido em apps/api/.env.");
  }
  return match[1];
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
