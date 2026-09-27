import assert from "node:assert/strict";
import test from "node:test";
import { collectPages, readPage } from "./page.js";

test("reads a paginated payload and stops after the last page", async () => {
  const pages = [
    { items: [1, 2], page: 1, limit: 2, total: 3, hasMore: true },
    { items: [3], page: 2, limit: 2, total: 3, hasMore: false },
  ];
  const seen = [];
  const collected = await collectPages(async (page) => {
    seen.push(page);
    return pages[page - 1];
  });
  assert.deepEqual(seen, [1, 2]);
  assert.deepEqual(collected, { items: [1, 2, 3], total: 3 });
  assert.equal(readPage([]).hasMore, false);
});
