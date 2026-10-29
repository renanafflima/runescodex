import { describe, expect, it } from "vitest";
import {
  bestiaryApiDifficulty,
  bestiaryListQueryFromFilters,
  filterBestiary,
  formatEstimatedHours,
  mapBestiaryEntry,
  recommendedEvolutionHunts,
  relevantBestiarySlugs,
  sortBestiaryEntries,
  sortBestiaryHunts,
  uniqueHuntCreatures,
} from "./bestiary";
import type { HuntListItem } from "../services/api/types";

describe("bestiary mapping", () => {
  it("maps API entries without inventing missing fields", () => {
    const mapped = mapBestiaryEntry({
      id: "1",
      name: "Cyclops",
      slug: "cyclops",
      image: "https://cdn.example/cyclops.gif",
      hp: 260,
      experience: 150,
      difficulty: "EASY",
      estimatedKillsPerHour: 250,
      killsRequired: 500,
      youtubeUrl: "https://www.youtube.com/watch?v=abc",
      locations: [{ name: "Thais", region: "Tibia" }],
      charmPoints: 25,
      together: [{ id: "c2", name: "Cyclops Drone", slug: "cyclops-drone", image: "Cyclops_Drone.gif" }],
      elements: [{ element: "Energy" }],
      progress: { kills: 125, completed: false, completedAt: null, progressPercentage: 25 },
    });

    expect(mapped).toMatchObject({
      name: "Cyclops",
      slug: "cyclops",
      difficulty: "Easy",
      location: "Thais",
      region: "Tibia",
      killsRequired: 500,
      estimatedHours: 2,
      charmPoints: 25,
      killTogether: ["Cyclops Drone"],
      companions: [{ name: "Cyclops Drone", slug: "cyclops-drone" }],
      progress: { kills: 125, progressPercentage: 25 },
    });
    expect(mapped.description).toBeNull();
    expect(mapped.image).toMatch(/images\/creatures\/Cyclops\.gif$/);
  });

  it("resolves stored creature paths and bare filenames to local assets", () => {
    const cases = [
      ["Acid Blob", "Acid_Blob.gif", "Acid_Blob.gif"],
      ["Adult Goanna", "runescodex/creatures/Adult_Goanna.gif", "Adult_Goanna.gif"],
      ["Amazon", "https://www.tibiawiki.com.br/images/Amazon.gif", "Amazon.gif"],
      ["Brinebrute Inferniarch", "runescodex/creatures/Brinebrute_Inferniarch.gif", "Brinebrute_Inferniarch.gif"],
      ["Hellhunter Inferniarch", "Hellhunter_Inferniarch.gif", "Hellhunter_Inferniarch.gif"],
      ["Spellreaper Inferniarch", "runescodex/creatures/Spellreaper_Inferniarch.gif", "Spellreaper_Inferniarch.gif"],
    ] as const;

    for (const [name, image, file] of cases) {
      const mapped = mapBestiaryEntry({
        name,
        slug: name.toLowerCase().replace(/\s+/g, "-"),
        image,
        locations: [],
        together: [],
        elements: [],
      });
      expect(mapped.image).toMatch(new RegExp(`images/creatures/${file.replace(".", "\\.")}$`));
    }
  });

  it("keeps the initials fallback when a creature has no local image", () => {
    const mapped = mapBestiaryEntry({
      name: "Creature Without Sprite",
      slug: "creature-without-sprite",
      image: "",
      locations: [],
      together: [],
      elements: [],
    });
    expect(mapped.image).toBeNull();
  });

  it("ignores unsafe image and video URLs", () => {
    const mapped = mapBestiaryEntry({
      name: "Dragon",
      slug: "dragon",
      image: "http://insecure.example/dragon.gif",
      youtubeUrl: "javascript:alert(1)",
      locations: [],
      together: [],
      elements: [],
    });
    expect(mapped.image).toMatch(/images\/creatures\/Dragon\.gif$/);
    expect(mapped.image?.startsWith("http:")).toBe(false);
    expect(mapped.youtubeUrl).toBeNull();
  });

  it("converts UI difficulty filters to API enums", () => {
    expect(bestiaryApiDifficulty("All")).toBeUndefined();
    expect(bestiaryApiDifficulty("Very Hard")).toBe("VERY_HARD");
  });

  it("sends search, difficulty and character filters to the bestiary API", () => {
    expect(
      bestiaryListQueryFromFilters({
        difficulty: "Hard",
        search: "  torturer ",
        page: 2,
        limit: 50,
        character: { id: "c1", name: "Nyxara", vocation: "RP", level: 150, world: "Honbra" },
      }),
    ).toEqual({
      difficulty: "HARD",
      search: "torturer",
      vocation: "RP",
      level: 150,
      page: 2,
      limit: 50,
    });
  });

  it("filters by search and keeps empty results empty", () => {
    const entries = [
      mapBestiaryEntry({ name: "Cyclops", slug: "cyclops", difficulty: "EASY", locations: [], together: [], elements: [] }),
    ];
    expect(filterBestiary(entries, "dragon", "All")).toEqual([]);
    expect(filterBestiary(entries, "cyc", "All")[0]?.slug).toBe("cyclops");
  });

  it("formats estimated hours without inventing a value", () => {
    expect(formatEstimatedHours(4)).toBe("≈ 4h");
    expect(formatEstimatedHours(null)).toBeNull();
    expect(formatEstimatedHours(0)).toBeNull();
  });
});

function huntItem(partial: Partial<HuntListItem> & Pick<HuntListItem, "slug" | "name">): HuntListItem {
  return {
    id: partial.id || partial.slug,
    location: null,
    subLocation: null,
    displayLocation: "",
    difficulty: null,
    respawn: null,
    vocations: [],
    creature: "",
    creatureImage: null,
    xpH: null,
    profitH: null,
    levelMin: null,
    levelMax: null,
    vocation: null,
    spawn: [],
    mapImage: null,
    youtubeUrl: null,
    ...partial,
  };
}

describe("bestiary hunt routes", () => {
  const prison = huntItem({
    slug: "roshamuul-prison",
    name: "Roshamuul Prison",
    levelMin: 450,
    spawn: [
      { id: "1", slug: "dark-torturer", name: "Dark Torturer", image: null, hp: null, xp: null, elements: [], recommendedCharm: null, damageType: null, killPerHour: null, isPrimary: true, quantity: null, notes: null },
      { id: "2", slug: "hellhound", name: "Hellhound", image: null, hp: null, xp: null, elements: [], recommendedCharm: null, damageType: null, killPerHour: null, isPrimary: false, quantity: null, notes: null },
    ],
  });
  const halls = huntItem({
    slug: "halls",
    name: "Halls of Ascension",
    levelMin: 400,
    spawn: [
      { id: "1", slug: "dark-torturer", name: "Dark Torturer", image: null, hp: null, xp: null, elements: [], recommendedCharm: null, damageType: null, killPerHour: null, isPrimary: false, quantity: null, notes: null },
    ],
  });

  it("prefers hunts where the selected creature is primary for the recommended route", () => {
    expect(recommendedEvolutionHunts([prison, halls], "dark-torturer").map((item) => item.slug)).toEqual([
      "roshamuul-prison",
    ]);
  });

  it("falls back to every hunt of the creature when none is marked primary", () => {
    const secondary = huntItem({
      ...halls,
      spawn: halls.spawn.map((item) => ({ ...item, isPrimary: false })),
    });
    expect(recommendedEvolutionHunts([secondary], "dark-torturer").map((item) => item.slug)).toEqual(["halls"]);
  });

  it("sorts hunts by the available fields from the reference", () => {
    expect(sortBestiaryHunts([prison, halls], "level").map((item) => item.slug)).toEqual([
      "halls",
      "roshamuul-prison",
    ]);
  });

  it("prioritizes hunts that match the active character", () => {
    const ekHunt = huntItem({
      ...prison,
      vocations: [{ vocation: "EK", isRecommended: true, levelMin: 400, levelMax: 500, xpPerHour: 1, profitPerHour: 1, difficulty: null, notes: null }],
    });
    const rpHunt = huntItem({
      ...halls,
      vocations: [{ vocation: "RP", isRecommended: true, levelMin: 100, levelMax: 200, xpPerHour: 1, profitPerHour: 1, difficulty: null, notes: null }],
    });
    const paladin = { id: "c1", name: "Nyxara", vocation: "RP", level: 150, world: "Honbra" };
    expect(sortBestiaryHunts([ekHunt, rpHunt], "level", paladin).map((item) => item.slug)).toEqual([
      "halls",
      "roshamuul-prison",
    ]);
    expect([...relevantBestiarySlugs([ekHunt, rpHunt], paladin)]).toEqual(["dark-torturer"]);
    expect(
      sortBestiaryEntries(
        [
          mapBestiaryEntry({ name: "Hellhound", slug: "hellhound", locations: [], together: [], elements: [] }),
          mapBestiaryEntry({ name: "Dark Torturer", slug: "dark-torturer", locations: [], together: [], elements: [] }),
        ],
        relevantBestiarySlugs([ekHunt, rpHunt], paladin),
      ).map((item) => item.slug),
    ).toEqual(["dark-torturer", "hellhound"]);
  });

  it("sorts hunts by name when requested", () => {
    expect(sortBestiaryHunts([prison, halls], "name").map((item) => item.slug)).toEqual([
      "halls",
      "roshamuul-prison",
    ]);
  });

  it("counts unique creatures across hunts", () => {
    expect(uniqueHuntCreatures([prison, halls]).map((item) => item.slug)).toEqual([
      "dark-torturer",
      "hellhound",
    ]);
  });
});
