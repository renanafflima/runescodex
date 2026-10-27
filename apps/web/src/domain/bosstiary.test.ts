import { describe, expect, it } from "vitest";
import {
  applyBossReview,
  bossImageUrl,
  filterBosstiary,
  indexBossImages,
  type BosstiaryEntry,
} from "./bosstiary";

function entry(overrides: Partial<BosstiaryEntry> = {}): BosstiaryEntry {
  return {
    name: "Ferumbras",
    slug: "ferumbras",
    sourceUrl: "https://www.tibiawiki.com.br/wiki/Ferumbras",
    isboss: "sim",
    source: "tibiawiki-candidate",
    party: null,
    recommendedLevel: null,
    imageUrl: null,
    rewards: [],
    location: null,
    bossPoints: null,
    ...overrides,
  };
}

const catalog = [
  entry(),
  entry({
    name: "Ghazbaran",
    slug: "ghazbaran",
    party: "party",
    recommendedLevel: 500,
  }),
  entry({
    name: "The Welter",
    slug: "the-welter",
    party: "event",
    recommendedLevel: 300,
  }),
];

describe("bosstiary filters", () => {
  it("matches the boss name and combines category with level", () => {
    expect(filterBosstiary(catalog, { query: "feru", party: "all", level: "all" }).map((item) => item.slug)).toEqual([
      "ferumbras",
    ]);
    expect(filterBosstiary(catalog, { query: "", party: "party", level: 500 }).map((item) => item.slug)).toEqual([
      "ghazbaran",
    ]);
    expect(filterBosstiary(catalog, { query: "ghaz", party: "solo", level: "all" })).toEqual([]);
    expect(filterBosstiary(catalog, { query: "", party: "event", level: 700 })).toEqual([]);
  });

  it("does not treat an unreviewed candidate as solo or as a recommended level", () => {
    expect(filterBosstiary(catalog, { query: "", party: "solo", level: "all" })).toEqual([]);
    expect(filterBosstiary(catalog, { query: "feru", party: "all", level: 300 })).toEqual([]);
  });

  it("applies only a reviewed classification and ignores a repeated slug", () => {
    const reviewed = applyBossReview(
      [entry()],
      [
        { slug: "ferumbras", party: "solo", recommendedLevel: 700 },
        { slug: "ferumbras", party: "party", recommendedLevel: 300 },
        { slug: "missing", party: "solo", recommendedLevel: 300 },
      ],
    );
    expect(reviewed[0]).toMatchObject({ party: "solo", recommendedLevel: 700 });
    expect(reviewed).toHaveLength(1);
  });

  it("uses a real sprite file and skips a duplicate copy", () => {
    const images = indexBossImages([
      { fileName: "Ferumbras (1).gif", url: "/duplicate.gif" },
      { fileName: "Ferumbras.gif", url: "/ferumbras.gif" },
    ]);
    expect(bossImageUrl("Ferumbras", "ferumbras", images)).toBe("/ferumbras.gif");
    expect(bossImageUrl("Rat", "rat", images)).toBeNull();
  });
});
