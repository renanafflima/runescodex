import assert from "node:assert/strict";
import test from "node:test";
import {
  assetsWithoutCreature,
  buildLocationCreatures,
  buildRelations,
  countExistingRelations,
  indexCreatures,
  indexImageAssets,
  matchCreatureName,
  matchImageAsset,
  normalizeCreatureName,
  planCreatureCatalog,
  renderCreatureInsertSql,
  renderCreatureTogetherSql,
  validateImport,
} from "./creature-together-lib.mjs";

const creatures = [
  { id: "id-brine", name: "Brinebrute Inferniarch", slug: "brinebrute-inferniarch" },
  { id: "id-hell", name: "Hellhunter Inferniarch", slug: "hellhunter-inferniarch" },
  { id: "id-spell", name: "Spellreaper Inferniarch", slug: "spellreaper-inferniarch" },
  { id: "id-demon", name: "Demon", slug: "demon" },
];

test("normalizes case, spaces, and underscores without fuzzy matching", () => {
  assert.equal(normalizeCreatureName(" Hellhunter_Inferniarch "), "hellhunter inferniarch");
  assert.notEqual(normalizeCreatureName("Demon"), normalizeCreatureName("Demon Skeleton"));
});

test("uses spawn lists when the hunt has spawn categories and skips bosses", () => {
  const locations = buildLocationCreatures({
    locationTitles: ["Castle Catacombs", "Ancient Temple"],
    spawnCategoryNames: ["Spawns/Castle Catacombs/nc", "Spawns/Ancient Temple/Rotworm Cave"],
    creaturePages: [
      {
        title: "Brinebrute Inferniarch",
        categories: [
          "Categoria:Criaturas",
          "Categoria:Criaturas de Castle Catacombs",
          "Categoria:Spawns/Castle Catacombs/nc",
        ],
      },
      {
        title: "Hellhunter Inferniarch",
        categories: ["Categoria:Spawns/Castle Catacombs/nc"],
      },
      {
        title: "Spellreaper Inferniarch",
        categories: ["Categoria:Criaturas de Castle Catacombs"],
      },
      {
        title: "Arbaziloth",
        categories: [
          "Categoria:Spawns/Castle Catacombs/nc",
          "Categoria:Bosses de Castle Catacombs",
        ],
      },
      {
        title: "Rotworm",
        categories: ["Categoria:Spawns/Ancient Temple/Rotworm Cave"],
      },
      {
        title: "Contested Creature",
        categories: ["Categoria:Spawns/Ancient Temple/Rotworm Cave", "Categoria:Página Contestada"],
      },
    ],
  });

  const castle = locations.find((location) => location.location === "Castle Catacombs");
  assert.deepEqual(castle.creatures, [
    "Brinebrute Inferniarch",
    "Hellhunter Inferniarch",
  ]);
  const temple = locations.find((location) => location.location === "Ancient Temple");
  assert.deepEqual(temple.creatures, ["Rotworm"]);
});

test("falls back to Criaturas de when the hunt has no spawn category", () => {
  const locations = buildLocationCreatures({
    locationTitles: ["Folda"],
    spawnCategoryNames: [],
    creaturePages: [
      {
        title: "Rotworm",
        categories: ["Categoria:Criaturas de Folda"],
      },
      {
        title: "Future Beast",
        categories: ["Categoria:Criaturas de Folda", "Categoria:Adicionado na versão futuro"],
      },
    ],
  });
  assert.deepEqual(locations[0].creatures, ["Rotworm"]);
});

test("builds every directed pair once and never a self pair", () => {
  const byName = indexCreatures(creatures);
  const { relations, unmatched } = buildRelations(
    [
      {
        location: "Castle Catacombs",
        creatures: [
          "Brinebrute Inferniarch",
          "Hellhunter Inferniarch",
          "Spellreaper Inferniarch",
          "Unknown Beast",
        ],
      },
      {
        location: "Other Cave",
        creatures: ["Brinebrute Inferniarch", "Hellhunter Inferniarch"],
      },
    ],
    (wikiName) => matchCreatureName(wikiName, byName),
  );

  assert.equal(relations.length, 6);
  assert.equal(relations.some((relation) => relation.creatureId === relation.relatedCreatureId), false);
  assert.deepEqual(unmatched, [
    {
      tibiawikiName: "Unknown Beast",
      location: "Castle Catacombs",
      reason: "Não encontrado em Creature",
    },
  ]);
  assert.equal(countExistingRelations(relations, new Set(["id-brine\0id-hell"])), 1);
});

test("does not guess between two creatures with the same normalized name", () => {
  const byName = indexCreatures([
    { id: "a", name: "Demon", slug: "demon" },
    { id: "b", name: "Demon", slug: "demon-alt" },
  ]);
  const result = matchCreatureName("demon", byName);
  assert.equal(result.creature, null);
  assert.equal(result.reason, "Correspondência ambígua em Creature");
});

test("sql only inserts CreatureTogether and stays idempotent", () => {
  const relations = [
    {
      creatureId: "id-brine",
      relatedCreatureId: "id-hell",
      creatureSlug: "brinebrute-inferniarch",
      relatedSlug: "hellhunter-inferniarch",
    },
  ];
  const sql = renderCreatureTogetherSql(relations);
  const errors = validateImport({
    locations: [{ location: "Castle Catacombs", creatures: ["Brinebrute Inferniarch"] }],
    relations,
    sql,
    knownCreatureIds: new Set(["id-brine", "id-hell"]),
    knownSlugs: new Set(["brinebrute-inferniarch", "hellhunter-inferniarch"]),
  });
  assert.deepEqual(errors, []);
  assert.match(sql, /ON CONFLICT \("creatureId", "relatedCreatureId"\) DO NOTHING/);
  assert.doesNotMatch(sql, /INSERT INTO "Creature"(?!Together)/);
  assert.doesNotMatch(sql, /\bUPDATE\b/);
  assert.doesNotMatch(sql, /\bDELETE\b/);
});

test("reuses the real asset filename and does not invent a missing image", () => {
  const assetIndex = indexImageAssets([
    "Brinebrute_Inferniarch.gif",
    "Cyclops_Smith.gif",
    "Wolf.gif",
    "Wolf (1).gif",
    "tibia_bestiary_creatures_and_hunts.xlsx",
  ]);
  const brine = matchImageAsset("Brinebrute Inferniarch", assetIndex);
  assert.equal(brine.image, "runescodex/creatures/Brinebrute_Inferniarch.gif");
  const plan = planCreatureCatalog({
    wikiNames: ["Brinebrute Inferniarch", "Missing Beast", "Cyclops Smith"],
    existingCreatures: [
      { id: "id-cyclops", name: "Cyclops Smith", slug: "cyclops-smith", image: "runescodex/creatures/Cyclops_Smith.gif" },
    ],
    assetIndex,
  });
  assert.deepEqual(
    plan.withoutImage.map((item) => item.name),
    ["Missing Beast"],
  );
  assert.equal(plan.toInsert.length, 1);
  assert.equal(plan.toInsert[0].name, "Brinebrute Inferniarch");
  assert.equal(plan.toInsert[0].image, brine.image);
  assert.equal(plan.catalog.some((item) => item.name === "Missing Beast"), false);
  assert.equal(plan.toInsert.some((item) => item.name === "Cyclops Smith"), false);
  const unused = assetsWithoutCreature({
    assetIndex,
    creatureNames: ["Brinebrute Inferniarch", "Cyclops Smith"],
    existingCreatures: [],
  });
  assert.ok(unused.includes("Wolf (1).gif"));
  assert.ok(unused.includes("Wolf.gif"));
  assert.ok(unused.includes("tibia_bestiary_creatures_and_hunts.xlsx"));
  const sql = renderCreatureInsertSql(plan.toInsert);
  assert.match(sql, /ON CONFLICT \("slug"\) DO NOTHING/);
  assert.doesNotMatch(sql, /\bUPDATE\b/);
  assert.doesNotMatch(sql, /\bDELETE\b/);
});
