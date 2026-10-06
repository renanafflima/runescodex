import { describe, expect, it } from "vitest";
import {
  filterAndSortHunts,
  huntCompatibility,
  huntListQueryFromFilters,
  mapHuntListItem,
} from "./hunts";
import type { HuntListItem } from "../services/api/types";

const ekHunt = {
  id: "1",
  slug: "cyclops",
  name: "Cyclops Hunt",
  location: "Thais",
  subLocation: "Cyclops Cave",
  difficulty: "EASY",
  vocations: [
    {
      vocation: "EK",
      isRecommended: true,
      levelMin: 40,
      levelMax: 120,
      xpPerHour: 180000,
      profitPerHour: 30000,
      difficulty: "EASY",
      notes: null,
    },
    {
      vocation: "RP",
      isRecommended: false,
      levelMin: 50,
      levelMax: 200,
      xpPerHour: 90000,
      profitPerHour: 20000,
      difficulty: "EASY",
      notes: null,
    },
  ],
  creatures: [
    {
      name: "Cyclops",
      slug: "cyclops",
      isPrimary: true,
      image: "https://cdn.example/cyclops.gif",
      recommendedCharm: "zap",
      damageType: "physical",
    },
  ],
};

const msHunt = {
  id: "2",
  slug: "dragon",
  name: "Dragon Hunt",
  location: "Darashia",
  vocations: [
    {
      vocation: "MS",
      isRecommended: true,
      levelMin: 80,
      levelMax: null,
      xpPerHour: 450000,
      profitPerHour: 60000,
    },
  ],
  creatures: [{ name: "Dragon", isPrimary: true, recommendedCharm: "enflame", damageType: "holy" }],
};

describe("hunt mapping and active character", () => {
  it("maps list items using the preferred vocation stats", () => {
    const mapped = mapHuntListItem(ekHunt, "EK");
    expect(mapped.slug).toBe("cyclops");
    expect(mapped.vocation).toBe("EK");
    expect(mapped.xpH).toBe(180000);
    expect(mapped.creature).toBe("Cyclops");
    expect(mapped.creatureImage).toContain("https://");
    expect(mapped.displayLocation).toBe("Thais - Cyclops Cave");
  });

  it("builds API filters from the active character", () => {
    expect(
      huntListQueryFromFilters({
        vocation: "EK",
        difficulty: "Any",
        character: { id: "c1", name: "Knight", vocation: "EK", level: 400, world: "Antica" },
      }),
    ).toEqual({ vocation: "EK", level: 400 });
  });

  it("keeps level from the active character when vocation is Any", () => {
    expect(
      huntListQueryFromFilters({
        vocation: "Any",
        difficulty: "HARD",
        character: { id: "c1", name: "Knight", vocation: "EK", level: 400, world: "Antica" },
      }),
    ).toEqual({ difficulty: "HARD", level: 400 });
  });

  it("ranks hunts by compatibility with the active character", () => {
    const ek = mapHuntListItem(ekHunt, "EK");
    const ms = mapHuntListItem(msHunt, "EK");
    const character = { id: "c1", name: "Knight", vocation: "EK", level: 50, world: "Antica" };
    expect(huntCompatibility(ek, character)).toBe(4);
    expect(huntCompatibility(ms, character)).toBe(0);

    const sorted = filterAndSortHunts([ms, ek], {
      query: "",
      vocation: "Any",
      minXpH: "",
      minProfitH: "",
      minLevel: "",
      sortBy: "Name",
      character,
    });
    expect(sorted.map((hunt) => hunt.slug)).toEqual(["cyclops", "dragon"]);
  });

  it("returns an empty list when nothing matches the client filters", () => {
    const hunts: HuntListItem[] = [mapHuntListItem(ekHunt, "EK")];
    const filtered = filterAndSortHunts(hunts, {
      query: "demon",
      vocation: "Any",
      minXpH: "",
      minProfitH: "",
      minLevel: "",
      sortBy: "Name",
      character: null,
    });
    expect(filtered).toEqual([]);
  });

  it("filters hunts by attack element from charm and by defense from damageType", () => {
    const hunts = [mapHuntListItem(ekHunt, "EK"), mapHuntListItem(msHunt, "MS")];
    const energy = filterAndSortHunts(hunts, {
      query: "",
      vocation: "Any",
      attackElement: "energy",
      minXpH: "",
      minProfitH: "",
      minLevel: "",
      sortBy: "Name",
      character: null,
    });
    expect(energy.map((hunt) => hunt.slug)).toEqual(["cyclops"]);

    const holyDefense = filterAndSortHunts(hunts, {
      query: "",
      vocation: "Any",
      defenseElement: "holy",
      minXpH: "",
      minProfitH: "",
      minLevel: "",
      sortBy: "Name",
      character: null,
    });
    expect(holyDefense.map((hunt) => hunt.slug)).toEqual(["dragon"]);
  });
});
