import { describe, expect, it } from "vitest";
import { loadBosstiaryCatalog } from "./bosstiary-catalog";

describe("bosstiary candidate catalog", () => {
  it("keeps TibiaWiki candidates unclassified until an editorial review exists", () => {
    const catalog = loadBosstiaryCatalog();
    const ferumbras = catalog.entries.find((entry) => entry.slug === "ferumbras");

    expect(catalog.skipped).toBe(0);
    expect(catalog.entries.length).toBeGreaterThan(500);
    expect(ferumbras).toMatchObject({
      name: "Ferumbras",
      isboss: "sim",
      source: "tibiawiki-candidate",
      party: null,
      recommendedLevel: null,
      rewards: [],
      location: null,
      bossPoints: null,
    });
    expect(catalog.entries.every((entry) => entry.party === null && entry.recommendedLevel === null)).toBe(true);
    expect(ferumbras?.sourceUrl.startsWith("https://www.tibiawiki.com.br/wiki/")).toBe(true);
    expect(typeof ferumbras?.imageUrl).toBe("string");
    expect(catalog.entries.filter((entry) => entry.imageUrl).length).toBeGreaterThan(300);
  });
});
