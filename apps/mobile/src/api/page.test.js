import assert from "node:assert/strict";
import test from "node:test";
import { collectPages, loadEntireCatalog, readPage } from "./page.js";

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

test("keeps a full catalog array and pages when the API returns a page", async () => {
  const entire = await loadEntireCatalog(async () => [
    { name: "Abyssal Calamary" },
    { name: "Acid Blob" },
  ]);
  assert.deepEqual(entire.map((item) => item.name), [
    "Abyssal Calamary",
    "Acid Blob",
  ]);

  const paged = await loadEntireCatalog(async (query) => {
    if (!query) {
      return { items: ["a"], page: 1, limit: 1, total: 2, hasMore: true };
    }
    return { items: ["a", "b"], page: 1, limit: 50, total: 2, hasMore: false };
  });
  assert.deepEqual(paged, ["a", "b"]);
});
