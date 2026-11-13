import { describe, expect, it } from "vitest";
import {
  applyBossReview,
  bossCombatStrategyText,
  bossImageUrl,
  bossLootText,
  bossesForLevelBand,
  BOSSTIARY_COMBAT_STRATEGY_MARKER,
  BOSSTIARY_LOOT_STRATEGY_PREFIX,
  filterBosstiary,
  formatBosstiaryLocationLine,
  formatBosstiaryReachLine,
  formatMinutes,
  indexBossImages,
  mergeBosstiaryProfile,
  splitBossStrategyContent,
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
    recommendedLevelSolo: null,
    recommendedLevelParty: null,
    imageUrl: null,
    rewards: [],
    location: null,
    locationRegion: null,
    originCity: null,
    bossPoints: null,
    officialCategory: null,
    difficulty: null,
    accessStatus: null,
    accessRequirements: null,
    howToReach: null,
    cooldownSeconds: null,
    estimatedCombatMinutes: null,
    mechanics: null,
    strategy: null,
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

  it("filters by official Bosstiary category", () => {
    const mixed = [
      entry({ slug: "black-knight", name: "Black Knight", officialCategory: "Bane" }),
      entry({ slug: "ferumbras", name: "Ferumbras", officialCategory: "Archfoe" }),
    ];
    expect(
      filterBosstiary(mixed, { query: "", party: "all", level: "all", officialCategory: "Bane" }).map(
        (item) => item.slug,
      ),
    ).toEqual(["black-knight"]);
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

  it("groups reviewed bosses by party and level band", () => {
    expect(bossesForLevelBand(catalog, "party", 500).map((item) => item.slug)).toEqual(["ghazbaran"]);
    expect(
      filterBosstiary(catalog, { query: "", party: "event", level: 300 }).map((item) => item.slug),
    ).toEqual(["the-welter"]);
  });

  it("formats minutes for rotation cards", () => {
    expect(formatMinutes(12)).toBe("12 min");
    expect(formatMinutes(12.4)).toBe("12,4 min");
    expect(formatMinutes(null)).toBeNull();
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

describe("bosstiary encyclopedia helpers", () => {
  it("splits loot drops from combat strategy without duplicating content", () => {
    const combined = `${BOSSTIARY_LOOT_STRATEGY_PREFIX} Demon Shield, Magic Sword${BOSSTIARY_COMBAT_STRATEGY_MARKER}Foque nas summons primeiro.`;
    expect(splitBossStrategyContent(combined)).toEqual({
      loot: "Demon Shield, Magic Sword",
      combatStrategy: "Foque nas summons primeiro.",
    });
    expect(splitBossStrategyContent(`${BOSSTIARY_LOOT_STRATEGY_PREFIX} Golden Helmet`)).toEqual({
      loot: "Golden Helmet",
      combatStrategy: null,
    });
    expect(splitBossStrategyContent("Use fire e mantenha distância.")).toEqual({
      loot: null,
      combatStrategy: "Use fire e mantenha distância.",
    });
  });

  it("formats location and reach lines from reviewed fields", () => {
    const profile = {
      location: "Ferumbras' Citadel",
      locationRegion: "Zao",
      originCity: "Farmine",
      howToReach: "Barco em Farmine até.",
      accessRequirements: "The Inquisition.",
    };
    expect(formatBosstiaryLocationLine(profile)).toBe("Ferumbras' Citadel · Zao · Farmine");
    expect(formatBosstiaryReachLine(profile)).toBe("Barco em Farmine até.\n\nThe Inquisition.");
  });

  it("exposes loot and strategy separately on an entry", () => {
    const encyclopediaEntry = entry({
      strategy: `${BOSSTIARY_LOOT_STRATEGY_PREFIX} Soul Orb${BOSSTIARY_COMBAT_STRATEGY_MARKER}Stack and kite.`,
    });
    expect(bossLootText(encyclopediaEntry)).toBe("Soul Orb");
    expect(bossCombatStrategyText(encyclopediaEntry)).toBe("Stack and kite.");
  });

  it("keeps wiki-estimated levels from the reviewed profile", () => {
    const merged = mergeBosstiaryProfile(entry(), {
      slug: "ferumbras",
      officialCategory: null,
      huntMode: null,
      recommendedLevelSolo: 450,
      recommendedLevelParty: 250,
      difficulty: null,
      locationName: null,
      locationRegion: null,
      originCity: null,
      accessStatus: null,
      accessRequirements: null,
      howToReach: null,
      cooldownSeconds: null,
      estimatedCombatMinutes: null,
      bossPoints: null,
      mechanics: null,
      strategy: null,
    });
    expect(merged.recommendedLevelSolo).toBe(450);
    expect(merged.recommendedLevelParty).toBe(250);
  });
});
