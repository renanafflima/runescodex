import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBestiaryFacts,
  killsRequiredFromWiki,
  parseInfoboxFields,
  renderBestiarySql,
  validateBestiarySql,
} from "./bestiary-lib.mjs";

const demon = `{{Infobox_Criatura|List={{{1|}}}|GetValue={{{GetValue|}}}
| name = Demon
| charm = 50
| creatureclass = Demônios
| ocorrencia = comum
| dificuldade = difícil
| isboss = não
| notes = Você pode caçar esta criatura para a [[Killing in the Name of... Quest|Paw & Fur Society]].
| history = Ignorar
}}`;

test("uses the published final stage for a common hard creature", () => {
  const facts = buildBestiaryFacts(parseInfoboxFields(demon));
  assert.equal(facts.killsRequired, 2500);
  assert.equal(facts.charmPoints, 50);
  assert.equal(facts.charmSource, "infobox");
  assert.equal(facts.category, "Demônios");
  assert.equal(facts.notes, "Você pode caçar esta criatura para a Paw & Fur Society.");
  assert.equal(facts.difficulty, "dificil");
});

test("does not invent kills for very rare hard creatures", () => {
  assert.equal(killsRequiredFromWiki("dificil", "muito raro"), null);
  assert.equal(killsRequiredFromWiki("desafiador", "muito raro"), null);
  assert.equal(killsRequiredFromWiki("medio", "muito raro"), 5);
  assert.equal(killsRequiredFromWiki("facil", "incomum"), 500);
  assert.equal(killsRequiredFromWiki("facil", null), null);
});

test("sql inserts only BestiaryEntry and keeps nullable fields null", () => {
  const rows = [
    {
      creatureId: "id-demon",
      slug: "demon",
      category: "Demônios",
      killsRequired: 2500,
      charmPoints: 50,
      notes: null,
    },
  ];
  const sql = renderBestiarySql(rows);
  const errors = validateBestiarySql({
    rows,
    sql,
    knownSlugs: new Set(["demon"]),
    existingCreatureIds: new Set(),
  });
  assert.deepEqual(errors, []);
  assert.match(sql, /NULL,\s*\n\s*pair\.charm_points/);
  assert.doesNotMatch(sql, /''/);
  assert.doesNotMatch(sql.replace(/--.*$/gm, ""), /INSERT INTO "Creature"/);
});
