/**
 * Collect TibiaWiki bosses for review.
 * A page is included only when Infobox_Criatura.isboss normalizes to "sim",
 * the same rule as buildBestiaryFacts. Hunt membership and the word "boss"
 * in a name are not used.
 *
 * Reads the wiki only. Does not read or write the database and does not
 * change bestiary files.
 *
 *   node scripts/build-bosses.mjs
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanWikiText,
  parseInfoboxFields,
  stripDiacritics,
} from "./bestiary-lib.mjs";
import { slugFromCreatureName } from "./creature-together-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "scripts");
const WIKI_API = "https://www.tibiawiki.com.br/api.php";
const WIKI_PAGE = "https://www.tibiawiki.com.br/wiki/";
const USER_AGENT = "RuneCodexBosses/1.0 (bosstiary review; read-only)";
const CANDIDATE_CATEGORY = "Categoria:Bosses";

function isBossValue(value) {
  return stripDiacritics(String(value || "").trim().toLowerCase()) === "sim";
}

function sourceUrl(title) {
  return `${WIKI_PAGE}${encodeURIComponent(title.replaceAll(" ", "_")).replace(/%2F/g, "/")}`;
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
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

async function listCandidateTitles() {
  const titles = [];
  let continuation = {};
  do {
    const data = await wikiQuery({
      action: "query",
      list: "categorymembers",
      cmtitle: CANDIDATE_CATEGORY,
      cmnamespace: "0",
      cmlimit: "500",
      cmprop: "title",
      ...continuation,
    });
    for (const member of data.query?.categorymembers ?? []) {
      titles.push(member.title);
    }
    continuation = data.continue ?? null;
    await delay(80);
  } while (continuation);
  return [...new Set(titles)];
}

async function fetchPages(titles) {
  const pages = [];
  const size = 40;
  for (let index = 0; index < titles.length; index += size) {
    const batch = titles.slice(index, index + size);
    const data = await wikiQuery({
      action: "query",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      titles: batch.join("|"),
      redirects: "1",
    });
    const redirects = new Map((data.query?.redirects ?? []).map((item) => [item.to, item.from]));
    for (const page of Object.values(data.query?.pages ?? {})) {
      const title = page.title;
      const content = page.revisions?.[0]?.slots?.main?.["*"] ?? page.revisions?.[0]?.["*"] ?? "";
      pages.push({
        requested: redirects.get(title) || title,
        title,
        missing: page.missing !== undefined,
        redirectedTo: redirects.has(title) ? title : null,
        wikitext: content,
      });
    }
    console.error(`Páginas lidas: ${Math.min(index + size, titles.length)}/${titles.length}`);
    await delay(80);
  }
  return pages;
}

function recordFromPage(page) {
  if (!page || page.missing) {
    return { failure: { title: page?.requested || page?.title || "", reason: "Página não encontrada" } };
  }
  const fields = parseInfoboxFields(page.wikitext || "");
  if (!fields) {
    return { failure: { title: page.title, reason: "A página não tem Infobox_Criatura" } };
  }
  const original = fields.isboss == null ? "" : String(fields.isboss).trim();
  if (!isBossValue(original)) {
    return {
      excluded: {
        title: page.title,
        isboss: original || null,
        reason: "isboss não é sim",
      },
    };
  }
  const name = cleanWikiText(fields.name) || cleanWikiText(page.title);
  if (!name) {
    return { failure: { title: page.title, reason: "A infobox não tem nome" } };
  }
  let slug = null;
  try {
    slug = slugFromCreatureName(name);
  } catch {
    return { failure: { title: page.title, name, reason: "Não foi possível normalizar o slug" } };
  }
  return {
    boss: {
      name,
      sourceUrl: sourceUrl(page.title),
      slug,
      isboss: original,
    },
  };
}

async function main() {
  const titles = await listCandidateTitles();
  const pages = await fetchPages(titles);
  const seenTitles = new Set(pages.flatMap((page) => [page.requested, page.title]));
  const failures = titles
    .filter((title) => !seenTitles.has(title))
    .map((title) => ({ title, reason: "A consulta não devolveu a página" }));
  const excluded = [];
  const bosses = [];

  for (const page of pages) {
    const result = recordFromPage(page);
    if (result.failure) failures.push(result.failure);
    if (result.excluded) excluded.push(result.excluded);
    if (result.boss) bosses.push(result.boss);
  }

  bosses.sort((left, right) => left.slug.localeCompare(right.slug, "en") || left.name.localeCompare(right.name, "en"));
  const slugCounts = new Map();
  for (const boss of bosses) {
    slugCounts.set(boss.slug, (slugCounts.get(boss.slug) ?? 0) + 1);
  }
  const duplicateSlugs = [...slugCounts.entries()].filter(([, count]) => count > 1).map(([slug]) => slug);

  const jsonPath = path.join(outputDir, "bosses-extracted.json");
  const csvPath = path.join(outputDir, "bosses-review.csv");
  await writeFile(jsonPath, `${JSON.stringify(bosses, null, 2)}\n`, "utf8");
  const csv = [
    "name,sourceUrl,slug,isboss",
    ...bosses.map((boss) => [boss.name, boss.sourceUrl, boss.slug, boss.isboss].map(csvCell).join(",")),
  ].join("\n");
  await writeFile(csvPath, `${csv}\n`, "utf8");

  console.log(JSON.stringify({
    candidateCategory: CANDIDATE_CATEGORY,
    candidates: titles.length,
    bosses: bosses.length,
    excludedBecauseIsbossIsNotSim: excluded.length,
    failures: failures.length,
    duplicateSlugs: duplicateSlugs.length,
    limitation: "Creature.id não é consultado. O slug é normalizado pelo nome da infobox, não pelo slug gravado no banco. A lista de páginas candidatas vem da categoria Bosses; a inclusão exige isboss = sim.",
    failureSample: failures.slice(0, 8),
    excludedSample: excluded.slice(0, 8),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
