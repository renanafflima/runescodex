import assert from "node:assert/strict";
import test from "node:test";
import {
  FORUM_CATEGORIES,
  forumCategoryTitleKey,
  forumThreadPayload,
} from "./forum-category.js";

test("maps the five forum categories accepted by the API", () => {
  assert.deepEqual(
    FORUM_CATEGORIES.map((item) => item.api),
    ["BESTIARY", "HUNTS", "PROFIT", "XP", "TIPS"],
  );
});

test("builds a create payload only with a valid category", () => {
  assert.deepEqual(
    forumThreadPayload({
      title: " Qual hunt? ",
      body: " Level 200 ",
      categoryId: "hunts",
    }),
    { title: "Qual hunt?", body: "Level 200", category: "HUNTS" },
  );
  assert.equal(forumThreadPayload({ title: "A", body: "B", categoryId: "geral" }), null);
  assert.equal(forumThreadPayload({ title: " ", body: "B", categoryId: "tips" }), null);
});

test("resolves stored API categories back to existing labels", () => {
  assert.equal(forumCategoryTitleKey("BESTIARY"), "forum.catBestiary");
  assert.equal(forumCategoryTitleKey("xp"), "forum.catXp");
  assert.equal(forumCategoryTitleKey(null), "");
});
