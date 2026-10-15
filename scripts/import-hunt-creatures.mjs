/**
 * Dry run for hunt/creature rows in
 * apps/mobile/scripts/runescodex_hunt_creature_elementos_charms.csv.
 *
 * Does not create Creature or Hunt rows and does not write to the database.
 * Kill-per-hour stays unstored: HuntCreature has no column for it.
 *
 *   npx --prefix apps/api tsx scripts/import-hunt-creatures.mjs
 */
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const apiDir = path.join(repoRoot, "apps", "api");
const requireFromApi = createRequire(path.join(apiDir, "package.json"));
const DEFAULT_CSV = path.join(
  repoRoot,
  "apps",
  "mobile",
  "scripts",
  "runescodex_hunt_creature_elementos_charms.csv",
);
const REPORT_PATH = path.join(scriptDir, "hunt-creature-import-report.json");
const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "postgres",
  "host.docker.internal",
]);
const CHARMS = new Set([
  "WOUND",
  "POISON",
  "ENFLAME",
  "FREEZE",
  "ZAP",
  "CURSE",
  "DIVINE_WRATH",
  "OVERPOWER",
  "OVERFLUX",
]);
const ELEMENTS = new Set([
  "PHYSICAL",
  "FIRE",
  "ICE",
  "EARTH",
  "ENERGY",
  "HOLY",
  "DEATH",
]);
const COLUMNS = [
  "hunt_id",
  "hunt_name",
  "hunt_creature_id",
  "creature_id",
  "creature_name",
  "damage_type",
  "is_primary",
  "quantity",
  "recommended_charm",
  "notes",
  "kill_per_hour",
  "estimate_type",
  "source_url",
  "confidence",
  "research_notes",
  "creature_image",
  "creature_hp",
  "elemental_type",
  "elemental_modifier",
  "creature_wiki_url",
  "elemental_weakness",
  "best_charm_unrestricted",
  "recommended_charm_unique_per_hunt",
  "charm_assignment_status",
  "elemental_source",
];

function redact(message) {
  return String(message)
    .replace(/(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/\S+/gi, "[redacted]")
    .replace(/password=\S+/gi, "password=[redacted]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]");
}

function publicError(error) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : "Unexpected error";
  const firstLine = redact(message).split("\n").map((line) => line.trim()).find(Boolean) ?? "Unexpected error";
  return [code, firstLine.slice(0, 300)].filter(Boolean).join(": ");
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

function cell(cells, index) {
  return index >= 0 ? String(cells[index] ?? "").trim() : "";
}

function integerValue(value) {
  if (!/^\d+(?:\.0+)?$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export function readHuntCsv(text) {
  const table = parseCsv(text);
  const header = table[0] ?? [];
  const missing = COLUMNS.filter((name) => !header.includes(name));
  if (missing.length > 0) {
    throw new Error(`CSV sem colunas: ${missing.join(", ")}`);
  }
  const index = Object.fromEntries(header.map((name, position) => [name, position]));
  return table.slice(1).map((cells, position) => ({
    line: position + 2,
    huntId: cell(cells, index.hunt_id),
    huntName: cell(cells, index.hunt_name),
    huntCreatureId: cell(cells, index.hunt_creature_id),
    creatureId: cell(cells, index.creature_id),
    creatureName: cell(cells, index.creature_name),
    damageType: cell(cells, index.damage_type),
    isPrimary: cell(cells, index.is_primary),
    quantity: cell(cells, index.quantity),
    recommendedCharm: cell(cells, index.recommended_charm),
    notes: cell(cells, index.notes),
    killPerHour: cell(cells, index.kill_per_hour),
    estimateType: cell(cells, index.estimate_type),
    creatureImage: cell(cells, index.creature_image),
    creatureHp: cell(cells, index.creature_hp),
    elementalType: cell(cells, index.elemental_type),
    elementalModifier: cell(cells, index.elemental_modifier),
    elementalWeakness: cell(cells, index.elemental_weakness),
    elementalSource: cell(cells, index.elemental_source),
    bestCharmUnrestricted: cell(cells, index.best_charm_unrestricted),
    recommendedCharmUniquePerHunt: cell(cells, index.recommended_charm_unique_per_hunt),
  }));
}

function storedFieldChanges(record, link) {
  const changes = [];
  if (record.damageType) {
    if (!ELEMENTS.has(record.damageType)) {
      return { error: "invalid_damage_type" };
    }
    if (link.damageType !== record.damageType) {
      changes.push("damageType");
    }
  }
  if (record.isPrimary) {
    if (record.isPrimary !== "True" && record.isPrimary !== "False") {
      return { error: "invalid_is_primary" };
    }
    const primary = record.isPrimary === "True";
    if (link.isPrimary !== primary) changes.push("isPrimary");
  }
  if (record.quantity) {
    const quantity = integerValue(record.quantity);
    if (quantity == null) return { error: "invalid_quantity" };
    if (link.quantity !== quantity) changes.push("quantity");
  }
  if (record.notes && link.notes !== record.notes) changes.push("notes");
  return { changes };
}

export function planHuntRows(records, hunts, creatures, links) {
  const huntsById = new Map(hunts.map((hunt) => [hunt.id, hunt]));
  const creaturesById = new Map(creatures.map((creature) => [creature.id, creature]));
  const linksById = new Map(links.map((link) => [link.id, link]));
  const linksByPair = new Map(links.map((link) => [`${link.huntId}:${link.creatureId}`, link]));
  const seenLinkIds = new Set();
  const charmOwners = new Map();

  const drafted = records.map((record) => {
    const problems = [];
    if (!record.huntId || !huntsById.has(record.huntId)) problems.push("hunt_not_found");
    else if (huntsById.get(record.huntId).name !== record.huntName) problems.push("hunt_name_mismatch");
    if (!record.creatureId || !record.creatureName) problems.push("creature_missing_in_source");
    else if (!creaturesById.has(record.creatureId)) problems.push("creature_not_found");
    else if (creaturesById.get(record.creatureId).name !== record.creatureName) problems.push("creature_name_mismatch");

    let link = null;
    if (record.huntCreatureId) {
      if (seenLinkIds.has(record.huntCreatureId)) problems.push("duplicate_hunt_creature_id");
      seenLinkIds.add(record.huntCreatureId);
      link = linksById.get(record.huntCreatureId) ?? null;
      if (!link) problems.push("hunt_creature_not_found");
      else if (link.huntId !== record.huntId || link.creatureId !== record.creatureId) {
        problems.push("hunt_creature_identity_mismatch");
      }
    } else if (record.huntId && record.creatureId) {
      link = linksByPair.get(`${record.huntId}:${record.creatureId}`) ?? null;
      if (!link) problems.push("hunt_creature_not_found");
    }

    let charmError = null;
    if (record.recommendedCharm) {
      if (!CHARMS.has(record.recommendedCharm)) charmError = "invalid_charm";
      else {
        const key = `${record.huntId}:${record.recommendedCharm}`;
        const owners = charmOwners.get(key) ?? [];
        owners.push(record.line);
        charmOwners.set(key, owners);
      }
    }
    if (record.bestCharmUnrestricted || record.recommendedCharmUniquePerHunt) {
      charmError = charmError ?? "unassigned_charm_column_ignored";
    }

    return { record, link, problems, charmError, changes: [] };
  });

  for (const item of drafted) {
    if (!item.record.recommendedCharm || item.charmError) continue;
    const key = `${item.record.huntId}:${item.record.recommendedCharm}`;
    if ((charmOwners.get(key) ?? []).length > 1) {
      item.charmError = "charm_duplicated_in_hunt";
      continue;
    }
    const occupied = links.find((link) => (
      link.huntId === item.record.huntId
      && link.recommendedCharm === item.record.recommendedCharm
      && link.id !== item.link?.id
    ));
    if (occupied) item.charmError = "charm_already_used_in_hunt";
  }

  return drafted.map((item) => {
    const killPerHour = item.record.killPerHour ? integerValue(item.record.killPerHour) : null;
    const elementalPresent = Boolean(
      item.record.elementalType
      || item.record.elementalModifier
      || item.record.elementalWeakness
      || item.record.elementalSource,
    );
    const base = {
      line: item.record.line,
      huntId: item.record.huntId,
      huntName: item.record.huntName,
      huntCreatureId: item.record.huntCreatureId || null,
      creatureId: item.record.creatureId || null,
      creatureName: item.record.creatureName || null,
      estimateType: item.record.estimateType || null,
      proposedKillPerHour: killPerHour,
      killPerHourStored: false,
      elementalPresent,
      status: "pending",
      reason: null,
      fieldChanges: [],
    };
    if (item.record.killPerHour && killPerHour == null) {
      item.problems.push("invalid_kill_per_hour");
    }
    if (item.problems.length === 1 && item.problems[0] === "creature_missing_in_source") {
      return { ...base, status: "pending", reason: "creature_missing_in_source" };
    }
    if (item.problems.length > 0 || item.charmError === "invalid_charm") {
      return {
        ...base,
        status: "rejected",
        reason: [...item.problems, item.charmError].filter(Boolean).join(","),
      };
    }
    if (!item.link) {
      return { ...base, status: "pending", reason: "hunt_creature_not_found" };
    }
    const stored = storedFieldChanges(item.record, item.link);
    if (stored.error) {
      return { ...base, status: "rejected", reason: stored.error };
    }
    const changes = [...stored.changes];
    if (item.record.recommendedCharm && !item.charmError && item.link.recommendedCharm !== item.record.recommendedCharm) {
      changes.push("recommendedCharm");
    }
    if (item.charmError === "charm_duplicated_in_hunt" || item.charmError === "charm_already_used_in_hunt") {
      return {
        ...base,
        huntCreatureId: item.link.id,
        status: "pending",
        reason: item.charmError,
        fieldChanges: changes.filter((field) => field !== "recommendedCharm"),
      };
    }
    if (changes.length > 0) {
      return {
        ...base,
        huntCreatureId: item.link.id,
        status: "ready",
        reason: item.record.killPerHour ? "kill_per_hour_has_no_column" : null,
        fieldChanges: changes,
      };
    }
    return {
      ...base,
      huntCreatureId: item.link.id,
      status: "pending",
      reason: item.record.killPerHour ? "kill_per_hour_has_no_column" : "no_stored_field_changes",
    };
  });
}

function loadConnectionString() {
  const dotenv = requireFromApi("dotenv");
  dotenv.config({ path: path.join(apiDir, ".env"), quiet: true });
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Export the remote URL in this process. Do not use apps/api/.env.");
  }
  let host = "";
  try {
    host = new URL(connectionString).hostname;
  } catch {
    throw new Error("DATABASE_URL is not a valid URL.");
  }
  if (LOCAL_HOSTS.has(host)) {
    throw new Error("Refusing the local development database. This process needs the remote DATABASE_URL already set in the terminal.");
  }
  return connectionString;
}

async function createPrisma(connectionString) {
  const { PrismaPg } = requireFromApi("@prisma/adapter-pg");
  const clientUrl = pathToFileURL(path.join(apiDir, "generated", "prisma", "client.ts")).href;
  const { PrismaClient } = await import(clientUrl);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

function summarize(rows) {
  const count = (status) => rows.filter((row) => row.status === status).length;
  return {
    inputRecords: rows.length,
    ready: count("ready"),
    pending: count("pending"),
    rejected: count("rejected"),
    publishedEstimates: rows.filter((row) => row.estimateType === "Publicado").length,
    heuristicEstimates: rows.filter((row) => row.estimateType === "Estimativa heurística").length,
    killPerHourPresent: rows.filter((row) => row.proposedKillPerHour != null).length,
    killPerHourStored: 0,
    elementalRows: rows.filter((row) => row.elementalPresent).length,
    charmUpdates: rows.filter((row) => row.fieldChanges.includes("recommendedCharm")).length,
    databaseWrite: 0,
  };
}

async function main() {
  const apply = process.argv.slice(2).includes("--apply");
  if (apply) {
    throw new Error("Refusing --apply. HuntCreature has no kill-per-hour column, and this importer does not write.");
  }
  if (!existsSync(DEFAULT_CSV)) {
    throw new Error("CSV não encontrado em apps/mobile/scripts/runescodex_hunt_creature_elementos_charms.csv");
  }
  const records = readHuntCsv(await readFile(DEFAULT_CSV, "utf8"));
  const connectionString = loadConnectionString();
  const prisma = await createPrisma(connectionString);
  try {
    const [creatureCount, huntCount, linkCount] = await Promise.all([
      prisma.creature.count(),
      prisma.hunt.count(),
      prisma.huntCreature.count(),
    ]);
    const huntIds = [...new Set(records.map((row) => row.huntId).filter(Boolean))];
    const creatureIds = [...new Set(records.map((row) => row.creatureId).filter(Boolean))];
    const linkIds = [...new Set(records.map((row) => row.huntCreatureId).filter(Boolean))];
    const [hunts, creatures, links] = await Promise.all([
      prisma.hunt.findMany({ where: { id: { in: huntIds } }, select: { id: true, name: true } }),
      prisma.creature.findMany({ where: { id: { in: creatureIds } }, select: { id: true, name: true } }),
      prisma.huntCreature.findMany({
        where: { OR: [{ id: { in: linkIds } }, { huntId: { in: huntIds } }] },
        select: {
          id: true,
          huntId: true,
          creatureId: true,
          damageType: true,
          isPrimary: true,
          quantity: true,
          recommendedCharm: true,
          notes: true,
        },
      }),
    ]);
    const planned = planHuntRows(records, hunts, creatures, links);
    const report = {
      mode: "dry-run",
      input: "apps/mobile/scripts/runescodex_hunt_creature_elementos_charms.csv",
      generatedAt: new Date().toISOString(),
      database: { creatures: creatureCount, hunts: huntCount, huntCreatures: linkCount },
      schema: {
        killPerHourColumn: null,
        recommendedCharm: "HuntCreature.recommendedCharm",
        elementalColumnsInCsv: ["elemental_type", "elemental_modifier", "elemental_weakness", "elemental_source"],
      },
      summary: summarize(planned),
      ready: planned.filter((row) => row.status === "ready"),
      pending: planned.filter((row) => row.status === "pending"),
      rejected: planned.filter((row) => row.status === "rejected"),
    };
    await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({
      mode: report.mode,
      input: report.input,
      report: "scripts/hunt-creature-import-report.json",
      database: report.database,
      summary: report.summary,
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error(publicError(error));
    process.exit(1);
  });
}
