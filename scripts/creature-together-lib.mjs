/**
 * Pure helpers for the TibiaWiki CreatureTogether import.
 * No database access and no wiki access live here.
 */

const CATEGORY_PREFIX = "Categoria:";
const CREATURES_OF_PREFIX = "Criaturas de ";
const QUEST_CREATURES_PREFIX = "Criaturas de Quests de ";
const INVASION_CREATURES_PREFIX = "Criaturas de Invasões de ";
const BOSSES_OF_PREFIX = "Bosses de ";
const INVASION_BOSSES_PREFIX = "Bosses de Invasões de ";
const SPAWNS_PREFIX = "Spawns/";
const CONTESTED_CATEGORY = "Página Contestada";
const FUTURE_CATEGORY = "Adicionado na versão futuro";

export function normalizeCreatureName(value) {
  return value.normalize("NFKC").replace(/_/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

export function stripCategoryPrefix(title) {
  return title.startsWith(CATEGORY_PREFIX) ? title.slice(CATEGORY_PREFIX.length) : title;
}

export function locationsByLength(locationTitles) {
  return [...locationTitles].sort((left, right) => right.length - left.length || left.localeCompare(right));
}

export function matchSpawnLocation(categoryName, sortedLocations) {
  if (!categoryName.startsWith(SPAWNS_PREFIX)) {
    return null;
  }
  const rest = categoryName.slice(SPAWNS_PREFIX.length);
  for (const location of sortedLocations) {
    if (rest.startsWith(`${location}/`)) {
      return location;
    }
  }
  return null;
}

export function classifyCategory(categoryName, locationSet, sortedLocations) {
  if (categoryName === CONTESTED_CATEGORY) {
    return { kind: "contested" };
  }
  if (categoryName === FUTURE_CATEGORY) {
    return { kind: "future" };
  }
  if (categoryName.startsWith(INVASION_BOSSES_PREFIX)) {
    const location = categoryName.slice(INVASION_BOSSES_PREFIX.length);
    return locationSet.has(location) ? { kind: "exclude", location } : { kind: "ignore" };
  }
  if (categoryName.startsWith(BOSSES_OF_PREFIX)) {
    const location = categoryName.slice(BOSSES_OF_PREFIX.length);
    return locationSet.has(location) ? { kind: "exclude", location } : { kind: "ignore" };
  }
  if (categoryName.startsWith(QUEST_CREATURES_PREFIX)) {
    const location = categoryName.slice(QUEST_CREATURES_PREFIX.length);
    return locationSet.has(location) ? { kind: "exclude", location } : { kind: "ignore" };
  }
  if (categoryName.startsWith(INVASION_CREATURES_PREFIX)) {
    const location = categoryName.slice(INVASION_CREATURES_PREFIX.length);
    return locationSet.has(location) ? { kind: "exclude", location } : { kind: "ignore" };
  }
  if (categoryName.startsWith(CREATURES_OF_PREFIX)) {
    const location = categoryName.slice(CREATURES_OF_PREFIX.length);
    return locationSet.has(location) ? { kind: "direct", location } : { kind: "ignore" };
  }
  const spawnLocation = matchSpawnLocation(categoryName, sortedLocations);
  if (spawnLocation) {
    return { kind: "spawn", location: spawnLocation };
  }
  return { kind: "ignore" };
}

/**
 * Mirrors Predefinição:Infobox Hunts:
 * when a hunt has spawn categories, the Criaturas section comes from those
 * spawns; otherwise it comes from "Criaturas de {local}".
 * Bosses, quest creatures, invasion creatures and contested pages are excluded.
 */
export function buildLocationCreatures({ locationTitles, spawnCategoryNames, creaturePages }) {
  const locationSet = new Set(locationTitles);
  const sortedLocations = locationsByLength(locationTitles);
  const locationsWithSpawnCategories = new Set();

  for (const categoryName of spawnCategoryNames) {
    const location = matchSpawnLocation(categoryName, sortedLocations);
    if (location) {
      locationsWithSpawnCategories.add(location);
    }
  }

  const direct = new Map();
  const spawned = new Map();

  for (const page of creaturePages) {
    if (page.redirect) {
      continue;
    }
    const excludedAt = new Set();
    const directAt = new Set();
    const spawnedAt = new Set();
    let contested = false;
    let future = false;

    for (const rawCategory of page.categories) {
      const categoryName = stripCategoryPrefix(rawCategory);
      const classified = classifyCategory(categoryName, locationSet, sortedLocations);
      if (classified.kind === "contested") {
        contested = true;
      } else if (classified.kind === "future") {
        future = true;
      } else if (classified.kind === "exclude") {
        excludedAt.add(classified.location);
      } else if (classified.kind === "direct") {
        directAt.add(classified.location);
      } else if (classified.kind === "spawn") {
        spawnedAt.add(classified.location);
      }
    }

    if (contested) {
      continue;
    }

    for (const location of spawnedAt) {
      if (excludedAt.has(location)) {
        continue;
      }
      addCreature(spawned, location, page.title);
    }

    if (future) {
      continue;
    }

    for (const location of directAt) {
      if (excludedAt.has(location)) {
        continue;
      }
      addCreature(direct, location, page.title);
    }
  }

  const locations = locationTitles.map((location) => {
    const names = locationsWithSpawnCategories.has(location)
      ? spawned.get(location)
      : direct.get(location);
    return {
      location,
      creatures: [...(names ?? new Set())].sort((left, right) => left.localeCompare(right, "en")),
    };
  });

  locations.sort((left, right) => left.location.localeCompare(right.location, "en"));
  return locations;
}

function addCreature(map, location, creatureName) {
  const current = map.get(location) ?? new Set();
  current.add(creatureName);
  map.set(location, current);
}

export function indexCreatures(creatures) {
  const byName = new Map();
  for (const creature of creatures) {
    const key = normalizeCreatureName(creature.name);
    const bucket = byName.get(key) ?? [];
    bucket.push(creature);
    byName.set(key, bucket);
  }
  return byName;
}

export function matchCreatureName(wikiName, creaturesByNormalizedName) {
  const matches = creaturesByNormalizedName.get(normalizeCreatureName(wikiName)) ?? [];
  if (matches.length === 1) {
    return { creature: matches[0], reason: null };
  }
  if (matches.length > 1) {
    return {
      creature: null,
      reason: "Correspondência ambígua em Creature",
    };
  }
  return {
    creature: null,
    reason: "Não encontrado em Creature",
  };
}

export function buildRelations(locations, resolveCreature) {
  const relations = new Map();
  const unmatched = [];
  const matchCache = new Map();

  function resolve(wikiName) {
    if (!matchCache.has(wikiName)) {
      matchCache.set(wikiName, resolveCreature(wikiName));
    }
    return matchCache.get(wikiName);
  }

  for (const location of locations) {
    const matched = [];
    for (const wikiName of location.creatures) {
      const result = resolve(wikiName);
      if (!result.creature) {
        unmatched.push({
          tibiawikiName: wikiName,
          location: location.location,
          reason: result.reason,
        });
        continue;
      }
      matched.push(result.creature);
    }

    const unique = [];
    const seenIds = new Set();
    for (const creature of matched) {
      if (seenIds.has(creature.id)) {
        continue;
      }
      seenIds.add(creature.id);
      unique.push(creature);
    }

    for (const source of unique) {
      for (const related of unique) {
        if (source.id === related.id) {
          continue;
        }
        const key = `${source.id}\0${related.id}`;
        if (!relations.has(key)) {
          relations.set(key, {
            creatureId: source.id,
            relatedCreatureId: related.id,
            creatureSlug: source.slug,
            relatedSlug: related.slug,
          });
        }
      }
    }
  }

  unmatched.sort((left, right) => {
    const byName = left.tibiawikiName.localeCompare(right.tibiawikiName, "en");
    return byName || left.location.localeCompare(right.location, "en");
  });

  return {
    relations: [...relations.values()].sort((left, right) => {
      const bySource = left.creatureSlug.localeCompare(right.creatureSlug, "en");
      return bySource || left.relatedSlug.localeCompare(right.relatedSlug, "en");
    }),
    unmatched,
  };
}

const IMAGE_EXTENSIONS = new Set([".gif", ".png", ".webp", ".jpg", ".jpeg"]);

export function expectedAssetStem(name) {
  return name.trim().replace(/\s+/g, "_");
}

export function slugFromCreatureName(name) {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) {
    throw new Error(`Não foi possível gerar slug para ${name}`);
  }
  return slug;
}

function splitFileName(fileName) {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) {
    return { stem: fileName, extension: "" };
  }
  return { stem: fileName.slice(0, dot), extension: fileName.slice(dot) };
}

export function indexImageAssets(fileNames) {
  const byStem = new Map();
  const ignored = [];
  for (const fileName of fileNames) {
    const { stem, extension } = splitFileName(fileName);
    if (!IMAGE_EXTENSIONS.has(extension.toLowerCase())) {
      ignored.push(fileName);
      continue;
    }
    const key = stem.toLowerCase();
    const bucket = byStem.get(key) ?? [];
    bucket.push({ fileName, extension, stem });
    byStem.set(key, bucket);
  }
  return { byStem, ignored };
}

export function matchImageAsset(creatureName, assetIndex) {
  const expectedAsset = expectedAssetStem(creatureName);
  const matches = assetIndex.byStem.get(expectedAsset.toLowerCase()) ?? [];
  if (matches.length === 1) {
    return {
      image: `runescodex/creatures/${matches[0].fileName}`,
      fileName: matches[0].fileName,
      expectedAsset,
      ambiguous: false,
    };
  }
  return {
    image: null,
    fileName: null,
    expectedAsset,
    ambiguous: matches.length > 1,
  };
}

export function creatureImageKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function planCreatureCatalog({ wikiNames, existingCreatures, assetIndex }) {
  const existingByName = indexCreatures(existingCreatures);
  const usedSlugs = new Map(existingCreatures.map((creature) => [creature.slug, creature.name]));
  const catalog = [];
  const toInsert = [];
  const withImage = [];
  const withoutImage = [];
  const namingDifferences = [];

  for (const name of [...new Set(wikiNames)].sort((left, right) => left.localeCompare(right, "en"))) {
    const asset = matchImageAsset(name, assetIndex);
    if (asset.image) {
      withImage.push({ name, image: asset.image, fileName: asset.fileName });
    } else {
      withoutImage.push({
        name,
        expectedAsset: asset.expectedAsset,
        reason: asset.ambiguous
          ? "Mais de um arquivo corresponde ao mesmo nome"
          : "Imagem não encontrada nos assets",
      });
      if (asset.ambiguous) {
        namingDifferences.push({
          name,
          expectedAsset: asset.expectedAsset,
          assets: (assetIndex.byStem.get(asset.expectedAsset.toLowerCase()) ?? []).map(
            (file) => file.fileName,
          ),
          reason: "Mais de um arquivo corresponde ao mesmo nome",
        });
      } else {
        const suggestion = suggestAsset(name, asset.expectedAsset, assetIndex);
        if (suggestion) {
          namingDifferences.push({
            name,
            expectedAsset: asset.expectedAsset,
            assets: [suggestion.fileName],
            reason: suggestion.reason,
          });
        }
      }
    }

    const existing = matchCreatureName(name, existingByName);
    if (existing.creature) {
      catalog.push({ ...existing.creature, name, isNew: false });
      continue;
    }
    if (existing.reason === "Correspondência ambígua em Creature") {
      namingDifferences.push({
        name,
        expectedAsset: asset.expectedAsset,
        assets: [],
        reason: existing.reason,
      });
      continue;
    }
    if (!asset.image) {
      continue;
    }

    let slug = slugFromCreatureName(name);
    const owner = usedSlugs.get(slug);
    if (owner && normalizeCreatureName(owner) !== normalizeCreatureName(name)) {
      const base = slug;
      let suffix = 2;
      while (usedSlugs.has(`${base}-${suffix}`)) {
        suffix += 1;
      }
      slug = `${base}-${suffix}`;
      namingDifferences.push({
        name,
        expectedAsset: asset.expectedAsset,
        assets: [],
        reason: `O slug ${base} já pertence a outra Creature. O cadastro usa ${slug}.`,
      });
    }
    usedSlugs.set(slug, name);
    const row = {
      id: `new:${slug}`,
      name,
      slug,
      image: asset.image ?? "",
      isNew: true,
    };
    catalog.push(row);
    toInsert.push(row);
  }

  for (const files of assetIndex.byStem.values()) {
    for (const file of files) {
      const duplicate = file.stem.match(/^(.*) \(\d+\)$/);
      if (!duplicate) {
        continue;
      }
      const canonical = assetIndex.byStem.get(duplicate[1].toLowerCase()) ?? [];
      namingDifferences.push({
        name: duplicate[1].replaceAll("_", " "),
        expectedAsset: duplicate[1],
        assets: [file.fileName, ...canonical.map((item) => item.fileName)],
        reason: "Arquivo duplicado com sufixo (1). O cadastro reutiliza o arquivo sem esse sufixo.",
      });
    }
  }

  namingDifferences.sort((left, right) =>
    `${left.expectedAsset}:${left.reason}`.localeCompare(`${right.expectedAsset}:${right.reason}`, "en"),
  );

  return { catalog, toInsert, withImage, withoutImage, namingDifferences };
}

function suggestAsset(name, expectedAsset, assetIndex) {
  const withoutQualifier = expectedAsset.replace(/_\([^)]+\)$/, "");
  if (withoutQualifier && withoutQualifier !== expectedAsset) {
    const matches = assetIndex.byStem.get(withoutQualifier.toLowerCase()) ?? [];
    if (matches.length === 1) {
      return {
        fileName: matches[0].fileName,
        reason: "O TibiaWiki usa um qualificador entre parênteses e o asset não",
      };
    }
  }
  const withCreature = assetIndex.byStem.get(`${expectedAsset}_(Criatura)`.toLowerCase()) ?? [];
  if (withCreature.length === 1 && creatureImageKey(name) !== creatureImageKey(withCreature[0].stem)) {
    return {
      fileName: withCreature[0].fileName,
      reason: "O asset inclui _(Criatura) e o nome do TibiaWiki não",
    };
  }
  return null;
}

export function assetsWithoutCreature({ assetIndex, creatureNames, existingCreatures }) {
  const knownStems = new Set();
  for (const name of creatureNames) {
    knownStems.add(expectedAssetStem(name).toLowerCase());
  }
  for (const creature of existingCreatures) {
    knownStems.add(expectedAssetStem(creature.name).toLowerCase());
    const fileName = String(creature.image || "").split("/").pop();
    if (fileName) {
      knownStems.add(splitFileName(fileName).stem.toLowerCase());
    }
  }

  const unused = [];
  for (const [stem, files] of assetIndex.byStem) {
    if (knownStems.has(stem)) {
      continue;
    }
    for (const file of files) {
      unused.push(file.fileName);
    }
  }
  for (const fileName of assetIndex.ignored) {
    unused.push(fileName);
  }
  return unused.sort((left, right) => left.localeCompare(right, "en"));
}

export function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function renderCreatureInsertSql(creatures, { chunkSize = 200 } = {}) {
  const header = `-- New Creature rows from TibiaWiki hunting locations.
-- Review only. Does not update or delete existing Creature rows.
-- Every inserted image is an existing asset path. Creatures without an
-- asset are omitted.
-- Safe to execute more than once.
-- Run this file before scripts/creature-together.sql.

`;
  if (creatures.some((creature) => !creature.image)) {
    throw new Error("Creature.image é NOT NULL. Criatura sem asset não entra no SQL.");
  }
  if (creatures.length === 0) {
    return `${header}-- No new Creature rows to insert.\n`;
  }

  const chunks = [];
  for (let index = 0; index < creatures.length; index += chunkSize) {
    const slice = creatures.slice(index, index + chunkSize);
    const values = slice
      .map(
        (creature) =>
          `  (${sqlLiteral(creature.name)}, ${sqlLiteral(creature.slug)}, ${sqlLiteral(creature.image ?? "")})`,
      )
      .join(",\n");
    chunks.push(`INSERT INTO "Creature" (
  "id",
  "name",
  "slug",
  "image",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  pair.name,
  pair.slug,
  pair.image,
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  VALUES
${values}
) AS pair(name, slug, image)
WHERE pair.image <> ''
  AND NOT EXISTS (
  SELECT 1
  FROM "Creature" AS existing
  WHERE existing."slug" = pair.slug
     OR lower(regexp_replace(existing."name", '[[:space:]_]+', ' ', 'g'))
        = lower(regexp_replace(pair.name, '[[:space:]_]+', ' ', 'g'))
)
ON CONFLICT ("slug") DO NOTHING;`);
  }

  return `${header}BEGIN;\n\n${chunks.join("\n\n")}\n\nCOMMIT;\n`;
}

export function renderCreatureTogetherSql(relations, { chunkSize = 400 } = {}) {
  const header = `-- CreatureTogether import from TibiaWiki hunting locations.
-- Review only. This file does not create Creature rows.
-- Run scripts/creatures.sql first so new slugs already exist.
-- Existing pairs are left unchanged: ON CONFLICT DO NOTHING.
-- Safe to execute more than once.

`;

  if (relations.length === 0) {
    return `${header}-- No new CreatureTogether rows to insert.\n`;
  }

  const chunks = [];
  for (let index = 0; index < relations.length; index += chunkSize) {
    const slice = relations.slice(index, index + chunkSize);
    const values = slice
      .map((relation) => `  (${sqlLiteral(relation.creatureSlug)}, ${sqlLiteral(relation.relatedSlug)})`)
      .join(",\n");
    chunks.push(`INSERT INTO "CreatureTogether" (
  "id",
  "creatureId",
  "relatedCreatureId",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  source_creature."id",
  related_creature."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  VALUES
${values}
) AS pair(source_slug, related_slug)
INNER JOIN "Creature" AS source_creature
  ON source_creature."slug" = pair.source_slug
INNER JOIN "Creature" AS related_creature
  ON related_creature."slug" = pair.related_slug
WHERE source_creature."id" <> related_creature."id"
ON CONFLICT ("creatureId", "relatedCreatureId") DO NOTHING;`);
  }

  return `${header}BEGIN;\n\n${chunks.join("\n\n")}\n\nCOMMIT;\n`;
}

export function validateImport({ locations, relations, sql, knownCreatureIds, knownSlugs }) {
  const errors = [];
  const seen = new Set();

  for (const relation of relations) {
    if (relation.creatureId === relation.relatedCreatureId) {
      errors.push(`Relação A → A: ${relation.creatureSlug}`);
    }
    if (relation.creatureSlug === relation.relatedSlug) {
      errors.push(`Slugs iguais: ${relation.creatureSlug}`);
    }
    const key = `${relation.creatureId}\0${relation.relatedCreatureId}`;
    if (seen.has(key)) {
      errors.push(`Relação duplicada: ${relation.creatureSlug} → ${relation.relatedSlug}`);
    }
    seen.add(key);
    if (!knownCreatureIds.has(relation.creatureId) || !knownCreatureIds.has(relation.relatedCreatureId)) {
      errors.push(`ID fora de Creature: ${relation.creatureSlug} → ${relation.relatedSlug}`);
    }
    if (!knownSlugs.has(relation.creatureSlug) || !knownSlugs.has(relation.relatedSlug)) {
      errors.push(`Slug fora de Creature: ${relation.creatureSlug} → ${relation.relatedSlug}`);
    }
  }

  const sqlCode = sql.replace(/--.*$/gm, "");
  if (/INSERT\s+INTO\s+"Creature"(?!Together)/i.test(sqlCode) || /\bUPDATE\b/i.test(sqlCode) || /\bDELETE\b/i.test(sqlCode)) {
    errors.push("SQL de relações altera Creature ou executa UPDATE/DELETE.");
  }
  if (relations.length > 0 && !/ON CONFLICT \("creatureId", "relatedCreatureId"\) DO NOTHING/i.test(sql)) {
    errors.push("SQL não é idempotente.");
  }
  if (!sql.includes("gen_random_uuid()::text")) {
    errors.push("SQL não usa gen_random_uuid()::text.");
  }

  const locationNames = locations.map((location) => location.location);
  if (new Set(locationNames).size !== locationNames.length) {
    errors.push("Local duplicado na extração.");
  }
  for (const location of locations) {
    if (new Set(location.creatures).size !== location.creatures.length) {
      errors.push(`Criatura duplicada em ${location.location}.`);
    }
  }

  return errors;
}

export function countExistingRelations(relations, existingPairs) {
  let existing = 0;
  for (const relation of relations) {
    if (existingPairs.has(`${relation.creatureId}\0${relation.relatedCreatureId}`)) {
      existing += 1;
    }
  }
  return existing;
}
