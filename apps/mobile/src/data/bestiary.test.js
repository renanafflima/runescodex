import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { bestiaryCardFields } from "./bestiary.js";
import { creatureImageKey, encodeCreatureAssetUri } from "./creature-image-key.js";

test("maps an API bestiary entry onto the existing card fields", () => {
  const card = bestiaryCardFields({
    id: "creature-1",
    name: "Abyssal Calamary",
    slug: "abyssal-calamary",
    image: "bestiary/abyssal-calamary.png",
    hp: null,
    difficulty: "EASY",
    youtubeUrl: null,
    killsRequired: 500,
    estimatedKillsPerHour: 250,
    estimatedHours: 2,
    elements: [{ element: "PHYSICAL", modifier: 100 }],
    locations: [{ name: "Calassa", region: "Sea" }],
    together: [{ name: "Blood Crab" }],
  });

  assert.equal(card.name, "Abyssal Calamary");
  assert.equal(card.difficulty, "Easy");
  assert.equal(card.location, "Calassa");
  assert.equal(card.region, "Sea");
  assert.deepEqual(card.killTogether, ["Blood Crab"]);
  assert.deepEqual(card.weaknesses, ["PHYSICAL"]);
  assert.equal(card.bestiaryKills, 500);
  assert.equal(card.estimatedHours, 2);
  assert.equal(card.vocation, undefined);
  assert.equal(card.recommendedLevel, undefined);
});

test("matches API image paths to the existing creature asset names", () => {
  assert.equal(
    creatureImageKey("bestiary/abyssal-calamary.png"),
    creatureImageKey("Abyssal_Calamary.gif"),
  );
  assert.equal(creatureImageKey("Angry Sugar Fairy"), "angrysugarfairy");
});

test("resolves the reported creatures from stored paths, filenames, and remote URLs", () => {
  const source = readFileSync(new URL("./creature-images.js", import.meta.url), "utf8");
  const cases = [
    ["Acid_Blob.gif", "acidblob", "Acid_Blob.gif"],
    ["runescodex/creatures/Adult_Goanna.gif", "adultgoanna", "Adult_Goanna.gif"],
    ["https://www.tibiawiki.com.br/images/Amazon.gif", "amazon", "Amazon.gif"],
    ["runescodex/creatures/Brinebrute_Inferniarch.gif", "brinebruteinferniarch", "Brinebrute_Inferniarch.gif"],
    ["Hellhunter_Inferniarch.gif", "hellhunterinferniarch", "Hellhunter_Inferniarch.gif"],
    ["Spellreaper Inferniarch", "spellreaperinferniarch", "Spellreaper_Inferniarch.gif"],
  ];

  for (const [value, key, file] of cases) {
    assert.equal(creatureImageKey(value), key);
    assert.ok(source.includes(`"${key}": require("../../assets/runescodex/creatures/${file}")`));
  }
  assert.equal(creatureImageKey(""), "");
});

test("encodes only unsafe characters in Expo web asset URIs", () => {
  const clean = "/assets/?unstable_path=.%2Fassets%2Frunescodex%2Fcreatures/Adult_Goanna.gif";
  assert.equal(encodeCreatureAssetUri(clean), clean);
  assert.equal(
    encodeCreatureAssetUri("/assets/?unstable_path=.%2Fassets%2Frunescodex%2Fcreatures/Wolf (1).gif"),
    "/assets/?unstable_path=.%2Fassets%2Frunescodex%2Fcreatures/Wolf%20(1).gif",
  );
});
