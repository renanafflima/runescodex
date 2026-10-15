/**
 * Imports initial bestiary kill-rate estimates.
 *
 * Default is a dry run of the resolved bestiary JSON.
 * Hunt rows belong to scripts/import-hunt-creatures.mjs.
 * Nothing is written to the database unless --apply is passed.
 *
 *   npx --prefix apps/api tsx scripts/import-bestiary-estimates.mjs
 *   npx --prefix apps/api tsx scripts/import-bestiary-estimates.mjs --apply
 *
 * Updates only BestiaryEntry.estimatedKillsPerHour. Does not create Creature
 * or BestiaryEntry rows and does not change category, kills, charms, or notes.
 */
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { slugFromCreatureName } from "./creature-together-lib.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const apiDir = path.join(repoRoot, "apps", "api");
const requireFromApi = createRequire(path.join(apiDir, "package.json"));
const INPUT_CANDIDATES = [
  path.join(scriptDir, "runescodex_bestiary_estimates_batch1.resolved.json"),
  path.join(scriptDir, "data", "runescodex_bestiary_estimates_batch1.json"),
  path.join(scriptDir, "runescodex_bestiary_estimates_batch1.json"),
];
const HUNT_CSV_NAME = "runescodex_hunt_creature_elementos_charms.csv";
const REPORT_PATH = path.join(scriptDir, "bestiary-estimates-import-report.json");
const RESOLVED_PATH = path.join(scriptDir, "runescodex_bestiary_estimates_batch1.resolved.json");
const UNRESOLVED_PATH = path.join(scriptDir, "bestiary-estimates-unresolved.json");
export const UNRESOLVED_REASONS = new Set([
  "creature_not_found",
  "name_not_found",
  "slug_not_found",
  "ambiguous_name",
  "ambiguous_slug",
  "name_and_slug_disagree",
  "duplicate_resolved_creature",
]);
const MAX_KILLS_PER_HOUR = 100_000;

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

function resolveInputPath(explicitPath) {
  if (explicitPath) {
    return path.resolve(repoRoot, explicitPath);
  }
  return INPUT_CANDIDATES.find((candidate) => existsSync(candidate)) ?? INPUT_CANDIDATES[0];
}

function missingInputError(filePath) {
  return new Error(`Input file not found: ${filePath}`);
}

function parseArgs(argv) {
  let apply = false;
  let inputPath = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg === "--input") {
      inputPath = argv[index + 1];
      if (!inputPath) {
        throw new Error("--input requires a file path.");
      }
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { apply, inputPath: resolveInputPath(inputPath) };
}

function relativeToRepo(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

export function validateEstimateRecords(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("The input JSON must be an object.");
  }
  if (!Array.isArray(payload.bestiaryEstimates)) {
    throw new Error("The input JSON must contain a bestiaryEstimates array.");
  }

  const valid = [];
  const invalid = [];
  const seen = new Set();

  payload.bestiaryEstimates.forEach((row, index) => {
    const position = index + 1;
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      invalid.push({ position, reason: "invalid_record" });
      return;
    }
    const creatureId = typeof row.creatureId === "string" ? row.creatureId.trim() : "";
    const creatureName = typeof row.creatureName === "string" ? row.creatureName.trim() : "";
    const proposed = row.estimatedKillsPerHour;
    const problems = [];
    if (!creatureId) problems.push("missing_creature_id");
    if (!creatureName) problems.push("missing_creature_name");
    if (!Number.isInteger(proposed) || proposed < 1 || proposed > MAX_KILLS_PER_HOUR) {
      problems.push("invalid_estimated_kills_per_hour");
    }
    if (creatureId && seen.has(creatureId)) {
      problems.push("duplicate_creature_id");
    }
    if (creatureId) seen.add(creatureId);
    if (problems.length > 0) {
      invalid.push({
        position,
        creatureId: creatureId || null,
        creatureName: creatureName || null,
        proposed: Number.isInteger(proposed) ? proposed : null,
        reason: problems.join(","),
      });
      return;
    }
    valid.push({
      creatureId,
      creatureName,
      proposed,
      source: typeof row.source === "string" ? row.source : null,
      estimatedHours: row.estimatedHours ?? null,
      assumedKillsForEstimate: row.assumedKillsForEstimate ?? null,
      charmPointsFromSource: row.charmPointsFromSource ?? null,
      confidence: typeof row.confidence === "string" ? row.confidence : null,
      note: typeof row.note === "string" ? row.note : null,
      slug: typeof row.slug === "string" ? row.slug.trim() : null,
    });
  });

  return { valid, invalid };
}

function groupBy(creatures, key) {
  const grouped = new Map();
  for (const creature of creatures) {
    const value = creature[key];
    const group = grouped.get(value) ?? [];
    group.push(creature);
    grouped.set(value, group);
  }
  return grouped;
}

function resolutionReason(nameMatches, slugMatches) {
  if (nameMatches.length === 0 && slugMatches.length === 0) return "creature_not_found";
  if (nameMatches.length === 0) return "name_not_found";
  if (nameMatches.length > 1) return "ambiguous_name";
  if (slugMatches.length === 0) return "slug_not_found";
  if (slugMatches.length > 1) return "ambiguous_slug";
  if (nameMatches[0].id !== slugMatches[0].id) return "name_and_slug_disagree";
  return null;
}

export function resolveEstimates(records, creatures, entries) {
  const byName = groupBy(creatures, "name");
  const bySlug = groupBy(creatures, "slug");
  const entriesByCreatureId = new Map(entries.map((entry) => [entry.creatureId, entry]));
  const rows = records.map((record) => {
    const expectedSlug = slugFromCreatureName(record.creatureName);
    const nameMatches = byName.get(record.creatureName) ?? [];
    const slugMatches = bySlug.get(expectedSlug) ?? [];
    const reason = resolutionReason(nameMatches, slugMatches);
    const row = {
      originalName: record.creatureName,
      oldCreatureId: record.creatureId,
      creatureId: null,
      slug: expectedSlug,
      bestiaryEntryExists: false,
      currentEstimatedKillsPerHour: null,
      proposedEstimatedKillsPerHour: record.proposed,
      action: "pending",
      reason,
      source: record.source,
      estimatedHours: record.estimatedHours,
      assumedKillsForEstimate: record.assumedKillsForEstimate,
      charmPointsFromSource: record.charmPointsFromSource,
      confidence: record.confidence,
      note: record.note,
    };
    if (reason) return row;

    const creature = nameMatches[0];
    const entry = entriesByCreatureId.get(creature.id);
    row.creatureId = creature.id;
    row.slug = creature.slug;
    if (!entry) {
      row.reason = "bestiary_entry_not_found";
      return row;
    }
    row.bestiaryEntryId = entry.id;
    row.bestiaryEntryExists = true;
    row.currentEstimatedKillsPerHour = entry.estimatedKillsPerHour;
    if (entry.estimatedKillsPerHour === record.proposed) {
      row.action = "unchanged";
      row.reason = "already_same_value";
      return row;
    }
    row.action = "update";
    row.reason = entry.estimatedKillsPerHour == null ? null : "overwrites_existing_estimate";
    return row;
  });

  const byResolvedId = new Map();
  for (const row of rows) {
    if (!row.creatureId || row.action === "pending") continue;
    const group = byResolvedId.get(row.creatureId) ?? [];
    group.push(row);
    byResolvedId.set(row.creatureId, group);
  }
  for (const group of byResolvedId.values()) {
    if (group.length < 2) continue;
    for (const row of group) {
      row.action = "pending";
      row.reason = "duplicate_resolved_creature";
    }
  }
  return rows;
}

export function planResolvedRecords(records, creatures, entries) {
  const creaturesById = new Map(creatures.map((creature) => [creature.id, creature]));
  const entriesByCreatureId = new Map(entries.map((entry) => [entry.creatureId, entry]));

  return records.map((record) => {
    const row = {
      originalName: record.creatureName,
      oldCreatureId: null,
      creatureId: record.creatureId,
      slug: record.slug,
      bestiaryEntryExists: false,
      bestiaryEntryId: null,
      currentEstimatedKillsPerHour: null,
      proposedEstimatedKillsPerHour: record.proposed,
      action: "pending",
      reason: null,
    };
    const creature = creaturesById.get(record.creatureId);
    if (!creature) {
      row.reason = "creature_not_found";
      return row;
    }
    if (creature.name !== record.creatureName) {
      row.reason = "name_mismatch";
      return row;
    }
    if (!record.slug || creature.slug !== record.slug || creature.slug !== slugFromCreatureName(record.creatureName)) {
      row.reason = "slug_mismatch";
      return row;
    }
    const entry = entriesByCreatureId.get(creature.id);
    if (!entry) {
      row.reason = "bestiary_entry_not_found";
      return row;
    }
    row.bestiaryEntryExists = true;
    row.bestiaryEntryId = entry.id;
    row.currentEstimatedKillsPerHour = entry.estimatedKillsPerHour;
    if (entry.estimatedKillsPerHour === record.proposed) {
      row.action = "unchanged";
      row.reason = "already_same_value";
      return row;
    }
    if (entry.estimatedKillsPerHour != null) {
      row.action = "held";
      row.reason = "existing_estimate_preserved";
      return row;
    }
    row.action = "update";
    return row;
  });
}

function reportRow(row) {
  return {
    originalName: row.originalName,
    oldCreatureId: row.oldCreatureId,
    creatureId: row.creatureId,
    slug: row.slug,
    bestiaryEntryExists: row.bestiaryEntryExists,
    currentEstimatedKillsPerHour: row.currentEstimatedKillsPerHour,
    proposedEstimatedKillsPerHour: row.proposedEstimatedKillsPerHour,
    action: row.action,
    reason: row.reason,
  };
}

function loadEnv() {
  const dotenv = requireFromApi("dotenv");
  dotenv.config({ path: path.join(apiDir, ".env"), quiet: true });
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is not set.");
  }
}

async function createPrisma() {
  loadEnv();
  const { PrismaPg } = requireFromApi("@prisma/adapter-pg");
  const clientUrl = pathToFileURL(path.join(apiDir, "generated", "prisma", "client.ts")).href;
  const { PrismaClient } = await import(clientUrl);
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
}

async function applyUpdates(prisma, updates) {
  await prisma.$transaction(async (tx) => {
    for (const update of updates) {
      const result = await tx.bestiaryEntry.updateMany({
        where: {
          id: update.bestiaryEntryId,
          creatureId: update.creatureId,
        },
        data: { estimatedKillsPerHour: update.proposedEstimatedKillsPerHour },
      });
      if (result.count !== 1) {
        throw new Error(`Bestiary entry for creature ${update.creatureId} was not updated.`);
      }
    }
  });
}

export function buildSimulationReport({ mode, inputPath, inputCount, invalid, rows, applied }) {
  const pendingInvalid = invalid.map((item) => ({
    originalName: item.creatureName,
    oldCreatureId: item.creatureId,
    creatureId: null,
    slug: null,
    bestiaryEntryExists: false,
    currentEstimatedKillsPerHour: null,
    proposedEstimatedKillsPerHour: item.proposed,
    action: "pending",
    reason: item.reason,
  }));
  const records = [...rows.map(reportRow), ...pendingInvalid];
  const ready = rows.filter((row) => row.action === "update");
  return {
    mode,
    input: relativeToRepo(inputPath),
    generatedAt: new Date().toISOString(),
    summary: {
      inputRecords: inputCount,
      readyToUpdate: ready.length,
      overwritesExisting: ready.filter((row) => row.reason === "overwrites_existing_estimate").length,
      unchanged: rows.filter((row) => row.action === "unchanged").length,
      pending: records.filter((row) => row.action === "pending").length,
      unresolvedNames: records.filter((row) => UNRESOLVED_REASONS.has(row.reason)).length,
      bestiaryEntryNotFound: records.filter((row) => row.reason === "bestiary_entry_not_found").length,
      applied,
    },
    records,
  };
}

export function buildResolvedImport(sourceMetadata, inputPath, rows) {
  return {
    metadata: {
      project: sourceMetadata?.project ?? "RuneCodex",
      purpose: sourceMetadata?.purpose ?? "Estimativas iniciais de kills por hora para Bestiário",
      source: sourceMetadata?.source ?? null,
      method: sourceMetadata?.method ?? null,
      resolution: "exact creature name and existing slug",
      resolvedFrom: relativeToRepo(inputPath),
      records: rows.length,
    },
    bestiaryEstimates: rows.map((row) => ({
      creatureId: row.creatureId,
      previousCreatureId: row.oldCreatureId,
      creatureName: row.originalName,
      slug: row.slug,
      estimatedKillsPerHour: row.proposedEstimatedKillsPerHour,
      estimatedHours: row.estimatedHours,
      assumedKillsForEstimate: row.assumedKillsForEstimate,
      charmPointsFromSource: row.charmPointsFromSource,
      source: row.source,
      confidence: row.confidence,
      note: row.note,
    })),
  };
}

async function main() {
  const { apply, inputPath } = parseArgs(process.argv.slice(2));
  if (!existsSync(inputPath)) {
    throw missingInputError(inputPath);
  }

  if (path.basename(inputPath) === HUNT_CSV_NAME) {
    throw new Error(
      "Esse CSV é de HuntCreature. Use scripts/import-hunt-creatures.mjs.",
    );
  }
  const raw = await readFile(inputPath, "utf8");
  const payload = JSON.parse(raw);
  const { valid, invalid } = validateEstimateRecords(payload);
  const prisma = await createPrisma();

  try {
    const creatures = await prisma.creature.findMany({
      select: { id: true, name: true, slug: true },
    });
    const entries = await prisma.bestiaryEntry.findMany({
      select: { id: true, creatureId: true, estimatedKillsPerHour: true },
    });
    const usingResolvedFile = path.resolve(inputPath) === path.resolve(RESOLVED_PATH);
    if (apply && !usingResolvedFile) {
      throw new Error("Refusing to apply a file other than the resolved bestiary import.");
    }
    const rows = usingResolvedFile
      ? planResolvedRecords(valid, creatures, entries)
      : resolveEstimates(valid, creatures, entries);
    const ready = rows.filter((row) => row.action === "update");

    if (apply && ready.length > 0) {
      await applyUpdates(prisma, ready);
    }
    if (usingResolvedFile) {
      const held = rows.filter((row) => row.action === "held");
      console.log(JSON.stringify({
        mode: apply ? "apply" : "simulation",
        input: relativeToRepo(inputPath),
        databaseWrite: apply ? ready.length : 0,
        summary: {
          inputRecords: payload.bestiaryEstimates.length,
          wouldUpdate: ready.length,
          heldExisting: held.length,
          unchanged: rows.filter((row) => row.action === "unchanged").length,
          pending: rows.filter((row) => row.action === "pending").length,
        },
        held,
        updates: ready.map(reportRow),
      }, null, 2));
      return;
    }

    const report = buildSimulationReport({
      mode: apply ? "apply" : "simulation",
      inputPath,
      inputCount: payload.bestiaryEstimates.length,
      invalid,
      rows,
      applied: apply ? ready.length : 0,
    });
    const unresolved = report.records.filter((row) => UNRESOLVED_REASONS.has(row.reason));
    await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await writeFile(
      RESOLVED_PATH,
      `${JSON.stringify(buildResolvedImport(payload.metadata, inputPath, ready), null, 2)}\n`,
      "utf8",
    );
    await writeFile(UNRESOLVED_PATH, `${JSON.stringify({
      generatedAt: report.generatedAt,
      records: unresolved.length,
      creatures: unresolved,
    }, null, 2)}\n`, "utf8");

    console.log(JSON.stringify({
      mode: report.mode,
      input: report.input,
      report: relativeToRepo(REPORT_PATH),
      resolvedImport: relativeToRepo(RESOLVED_PATH),
      unresolved: relativeToRepo(UNRESOLVED_PATH),
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
