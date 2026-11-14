import { describe, expect, it } from "vitest";
import { CATALOG_PAGE_SIZE, collectPages, loadEntireCatalog, readPage } from "./page";

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

  it("uses the API page size cap for catalog requests", () => {
    expect(CATALOG_PAGE_SIZE).toBe(50);
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

  it("infers hasMore when the API omits the flag but total exceeds the page", () => {
    expect(
      readPage({ items: Array.from({ length: 20 }, (_, i) => i), page: 1, limit: 20, total: 315 }),
    ).toMatchObject({ hasMore: true, total: 315 });
  });

  it("aggregates every page for a 315-boss encyclopedia", async () => {
    const pages: number[] = [];
    const items = await loadEntireCatalog(
      async (query) => {
        const page = query?.page ?? 1;
        const limit = query?.limit ?? 50;
        pages.push(page);
        const total = 315;
        const start = (page - 1) * limit;
        const chunk = Array.from(
          { length: Math.min(limit, total - start) },
          (_, i) => `boss-${start + i + 1}`,
        );
        return {
          items: chunk,
          page,
          limit,
          total,
          hasMore: start + chunk.length < total,
        };
      },
      { pageSize: 100 },
    );
    expect(items).toHaveLength(315);
    expect(pages).toEqual([1, 2, 3, 4]);
  });
});
