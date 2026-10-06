import assert from "node:assert/strict";
import test from "node:test";
import { bestiaryCardFields } from "./bestiary.js";
import { creatureImageKey } from "./creature-image-key.js";

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
