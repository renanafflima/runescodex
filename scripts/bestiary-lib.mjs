/**
 * Bestiary figures published by TibiaWiki.
 * Final-stage kills and charm points come from Predefinição:Tabela Bestiário.
 * The infobox charm value is preferred when the creature page states it.
 */

const KILLS_BY_DIFFICULTY = {
  inofensivo: { normal: 25, muitoRaro: 5 },
  trivial: { normal: 250, muitoRaro: 5 },
  facil: { normal: 500, muitoRaro: 5 },
  medio: { normal: 1000, muitoRaro: 5 },
  dificil: { normal: 2500, muitoRaro: null },
  desafiador: { normal: 5000, muitoRaro: null },
};

const CHARM_BY_DIFFICULTY = {
  inofensivo: { normal: 1, muitoRaro: 5 },
  trivial: { normal: 5, muitoRaro: 10 },
  facil: { normal: 15, muitoRaro: 30 },
  medio: { normal: 25, muitoRaro: 50 },
  dificil: { normal: 50, muitoRaro: 100 },
  desafiador: { normal: 100, muitoRaro: 200 },
};

export function normalizeLookupName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function stripDiacritics(value) {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

export function normalizeDifficulty(value) {
  const text = stripDiacritics(String(value || "").trim().toLowerCase());
  const known = {
    inofensivo: "inofensivo",
    trivial: "trivial",
    facil: "facil",
    medio: "medio",
    dificil: "dificil",
    desafiador: "desafiador",
  };
  return known[text] ?? null;
}

export function normalizeOccurrence(value) {
  const text = stripDiacritics(String(value || "").trim().toLowerCase());
  if (["comum", "incomum", "raro", "muito raro"].includes(text)) {
    return text;
  }
  return null;
}

export function killsRequiredFromWiki(difficulty, occurrence) {
  const row = KILLS_BY_DIFFICULTY[difficulty];
  if (!row || !occurrence) {
    return null;
  }
  return occurrence === "muito raro" ? row.muitoRaro : row.normal;
}

export function charmPointsFromTable(difficulty, occurrence) {
  const row = CHARM_BY_DIFFICULTY[difficulty];
  if (!row || !occurrence) {
    return null;
  }
  return occurrence === "muito raro" ? row.muitoRaro : row.normal;
}

export function parseIntegerField(value) {
  const text = String(value || "").trim();
  if (!/^\d+$/.test(text)) {
    return null;
  }
  return Number(text);
}

export function cleanWikiText(value) {
  const text = String(value || "")
    .replace(/\[\[Arquivo:[^\]]+\]\]/gi, "")
    .replace(/\{\{[^{}]+\}\}/g, "")
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/'''|''/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

export function parseInfoboxFields(wikitext) {
  const start = wikitext.search(/\{\{Infobox_Criatura\b/i);
  if (start < 0) {
    return null;
  }
  const fields = {};
  let current = null;
  for (const line of wikitext.slice(start).split("\n")) {
    if (line.trim() === "}}") {
      break;
    }
    const match = line.match(/^\|\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (match) {
      current = match[1];
      fields[current] = match[2];
      continue;
    }
    if (current) {
      fields[current] += `\n${line}`;
    }
  }
  return fields;
}

export function bestiaryCategory(creatureClass) {
  const cleaned = cleanWikiText(creatureClass);
  if (!cleaned) {
    return null;
  }
  if (cleaned === "Plantas (Criatura)") {
    return "Plantas";
  }
  return cleaned;
}

export function buildBestiaryFacts(fields) {
  if (!fields) {
    return null;
  }
  const difficulty = normalizeDifficulty(fields.dificuldade);
  const occurrence = normalizeOccurrence(fields.ocorrencia);
  const infoboxCharm = parseIntegerField(fields.charm);
  const charmPoints = infoboxCharm ?? charmPointsFromTable(difficulty, occurrence);
  return {
    difficulty,
    difficultyRaw: cleanWikiText(fields.dificuldade),
    occurrence,
    occurrenceRaw: cleanWikiText(fields.ocorrencia),
    category: bestiaryCategory(fields.creatureclass),
    killsRequired: killsRequiredFromWiki(difficulty, occurrence),
    charmPoints,
    charmSource: infoboxCharm !== null ? "infobox" : charmPoints !== null ? "tabela" : null,
    notes: cleanWikiText(fields.notes),
    isBoss: stripDiacritics(String(fields.isboss || "").trim().toLowerCase()) === "sim",
  };
}

export function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function sqlValue(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error(`Valor numérico inválido: ${value}`);
    }
    return String(value);
  }
  if (value === "") {
    throw new Error("String vazia não é permitida no SQL do bestiário.");
  }
  return sqlLiteral(value);
}

export function renderBestiarySql(rows, { chunkSize = 80 } = {}) {
  const header = `-- BestiaryEntry import from TibiaWiki.
-- Review only. Inserts BestiaryEntry rows for Creature records that already exist.
-- Does not insert or update Creature. estimatedKillsPerHour stays NULL.
-- Safe to execute more than once.

`;
  if (rows.length === 0) {
    return `${header}-- No new BestiaryEntry rows to insert.\n`;
  }
  const chunks = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    const slice = rows.slice(index, index + chunkSize);
    const values = slice
      .map(
        (row) =>
          `  (${sqlLiteral(row.slug)}, ${sqlValue(row.category)}, ${sqlValue(row.killsRequired)}, ${sqlValue(row.charmPoints)}, ${sqlValue(row.notes)})`,
      )
      .join(",\n");
    chunks.push(`INSERT INTO "BestiaryEntry" (
  "id",
  "creatureId",
  "category",
  "killsRequired",
  "estimatedKillsPerHour",
  "charmPoints",
  "notes",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  creature."id",
  pair.category,
  pair.kills_required,
  NULL,
  pair.charm_points,
  pair.notes,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  VALUES
${values}
) AS pair(slug, category, kills_required, charm_points, notes)
INNER JOIN "Creature" AS creature
  ON creature."slug" = pair.slug
WHERE NOT EXISTS (
  SELECT 1
  FROM "BestiaryEntry" AS existing
  WHERE existing."creatureId" = creature."id"
)
ON CONFLICT ("creatureId") DO NOTHING;`);
  }
  return `${header}BEGIN;\n\n${chunks.join("\n\n")}\n\nCOMMIT;\n`;
}

export function validateBestiarySql({ rows, sql, knownSlugs, existingCreatureIds }) {
  const errors = [];
  const seen = new Set();
  const sqlCode = sql.replace(/--.*$/gm, "");
  for (const row of rows) {
    if (!knownSlugs.has(row.slug)) {
      errors.push(`Slug fora de Creature: ${row.slug}`);
    }
    if (seen.has(row.slug)) {
      errors.push(`Slug duplicado: ${row.slug}`);
    }
    seen.add(row.slug);
    if (existingCreatureIds.has(row.creatureId)) {
      errors.push(`BestiaryEntry já existe: ${row.slug}`);
    }
    if (!Number.isInteger(row.killsRequired)) {
      errors.push(`killsRequired ausente: ${row.slug}`);
    }
    for (const field of ["category", "notes"]) {
      if (row[field] === "") {
        errors.push(`String vazia em ${field}: ${row.slug}`);
      }
    }
  }
  const withoutStrings = sqlCode.replace(/'(?:''|[^'])*'/g, "''");
  if (/INSERT\s+INTO\s+"Creature"\s*\(/i.test(withoutStrings) || /^\s*UPDATE\b/im.test(withoutStrings) || /^\s*DELETE\b/im.test(withoutStrings)) {
    errors.push("SQL altera Creature ou executa UPDATE/DELETE.");
  }
  if (rows.length > 0 && !sql.includes('ON CONFLICT ("creatureId") DO NOTHING')) {
    errors.push("SQL não é idempotente.");
  }
  if (rows.length > 0 && !sql.includes("gen_random_uuid()::text")) {
    errors.push("SQL não gera UUID no PostgreSQL.");
  }
  return errors;
}
