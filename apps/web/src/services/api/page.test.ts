import { describe, expect, it } from "vitest";
import { collectPages, loadEntireCatalog, readPage } from "./page";

describe("pagination helpers", () => {
  it("reads a page envelope", () => {
    expect(readPage({ items: [{ id: 1 }], page: 1, limit: 20, total: 1, hasMore: false })).toEqual({
      items: [{ id: 1 }],
      page: 1,
      limit: 20,
      total: 1,
      hasMore: false,
    });
  });

  it("falls back to an array payload", () => {
    expect(readPage([{ id: 2 }]).items).toEqual([{ id: 2 }]);
  });

  it("collects pages until hasMore is false", async () => {
    const result = await collectPages<{ id: number }>(async (page) => ({
      items: [{ id: page }],
      page,
      limit: 1,
      total: 2,
      hasMore: page < 2,
    }));
    expect(result.items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result.total).toBe(2);
  });

  it("loads the entire catalog when the first page is complete", async () => {
    const items = await loadEntireCatalog(async () => ({
      items: ["a", "b"],
      page: 1,
      limit: 20,
      total: 2,
      hasMore: false,
    }));
    expect(items).toEqual(["a", "b"]);
  });
});
