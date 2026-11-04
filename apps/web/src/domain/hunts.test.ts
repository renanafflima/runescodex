import { describe, expect, it } from "vitest";
import {
  filterAndSortHunts,
  groupHuntVocations,
  huntAttackElements,
  huntCompatibility,
  huntDefenseElements,
  huntListQueryFromFilters,
  huntLocationOptions,
  mapHuntAttention,
  mapHuntDetail,
  mapHuntListItem,
  pickHuntVocation,
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
      bestiary: {
        hasEntry: true,
        category: "Medium",
        killsRequired: 500,
        charmPoints: 10,
        estimatedKillsPerHour: null,
        estimatedHours: null,
        hoursEstimateSource: null,
        killsPerHourUsed: null,
      },
    },
  ],
  bestiarySummary: {
    totalCharmPoints: 10,
    creaturesWithEntry: 1,
    creatureCount: 1,
    totalEstimatedHours: null,
    estimatedHoursCreatureCount: 0,
  },
  bestAttack: {
    elements: ["ENERGY"],
    status: "COMPLETE",
    creatureCount: 1,
    creaturesWithAnyData: 1,
    creaturesWithoutData: 0,
  },
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
  it("maps hunt attention text from the API without trimming displayed content", () => {
    expect(mapHuntAttention("  Cuidado com PK  ")).toBe("  Cuidado com PK  ");
    expect(mapHuntAttention("   ")).toBeNull();
    expect(mapHuntAttention(null)).toBeNull();
  });

  it("preserves attention on hunt detail mapping", () => {
    const mapped = mapHuntDetail({
      id: "1",
      slug: "asura",
      name: "Asura Palace",
      vocations: [],
      attention: "Evite stack de muitas criaturas.",
      creatures: [],
    });
    expect(mapped.attention).toBe("Evite stack de muitas criaturas.");
  });

  it("maps list items using the preferred vocation stats", () => {
    const mapped = mapHuntListItem(ekHunt, "EK");
    expect(mapped.slug).toBe("cyclops");
    expect(mapped.vocation).toBe("EK");
    expect(mapped.xpH).toBe(180000);
    expect(mapped.creature).toBe("Cyclops");
    expect(mapped.creatureImage).toMatch(/images\/creatures\/Cyclops\.gif$/);
    expect(mapped.displayLocation).toBe("Thais - Cyclops Cave");
    expect(mapped.spawn[0]?.bestiary.charmPoints).toBe(10);
    expect(mapped.bestiarySummary.totalCharmPoints).toBe(10);
    expect(mapped.bestAttack?.elements).toEqual(["energy"]);
    expect(huntAttackElements(mapped)).toEqual(["energy"]);
  });

  it("uses list API bestAttack on cards even without creature elements on spawn", () => {
    const mapped = mapHuntListItem(
      {
        ...ekHunt,
        bestAttack: {
          elements: ["DEATH", "ICE"],
          status: "PARTIAL",
          creatureCount: 6,
          creaturesWithAnyData: 6,
          creaturesWithoutData: 0,
        },
        creatures: [{ name: "Soul-Broken Harbinger", slug: "soul-broken-harbinger", isPrimary: true }],
      },
      "EK",
    );
    expect(huntAttackElements(mapped)).toEqual(["death", "ice"]);
  });

  it("falls back to spawn elements when list payload has no bestAttack", () => {
    const mapped = mapHuntDetail({
      id: "h1",
      slug: "court-of-winter",
      name: "Court of Winter",
      vocations: [],
      creatures: [
        {
          isPrimary: true,
          creature: {
            name: "Thanatursus",
            elements: [
              { element: "DEATH", modifier: 110 },
              { element: "ICE", modifier: 120 },
            ],
          },
        },
      ],
    });
    expect(mapped.bestAttack).toBeNull();
    expect(huntAttackElements(mapped)).toEqual(["death", "ice"]);
  });

  it("does not treat an empty bestAttack payload as blocking fallback", () => {
    const mapped = mapHuntListItem(
      {
        ...ekHunt,
        bestAttack: {
          elements: [],
          status: "UNAVAILABLE",
          creatureCount: 1,
          creaturesWithAnyData: 0,
          creaturesWithoutData: 1,
        },
        creatures: [
          {
            name: "Cyclops",
            slug: "cyclops",
            isPrimary: true,
            recommendedCharm: "zap",
          },
        ],
      },
      "EK",
    );
    expect(mapped.bestAttack).toBeNull();
    expect(huntAttackElements(mapped)).toEqual(["energy"]);
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

  it("sends the search term to the hunts API", () => {
    expect(
      huntListQueryFromFilters({
        vocation: "EK",
        difficulty: "Any",
        search: "  prison  ",
        page: 2,
        limit: 50,
        character: { id: "c1", name: "Knight", vocation: "EK", level: 400, world: "Antica" },
      }),
    ).toEqual({ vocation: "EK", level: 400, search: "prison", page: 2, limit: 50 });
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

  it("derives unique location filter options from loaded hunts", () => {
    const hunts = [mapHuntListItem(ekHunt, "EK"), mapHuntListItem(msHunt, "MS")];
    expect(huntLocationOptions(hunts)).toEqual(["Darashia", "Thais"]);
  });

  it("filters hunts by exact location when a location filter is set", () => {
    const hunts = [mapHuntListItem(ekHunt, "EK"), mapHuntListItem(msHunt, "MS")];
    const thais = filterAndSortHunts(hunts, {
      query: "",
      vocation: "Any",
      location: "Thais",
      minXpH: "",
      minProfitH: "",
      minLevel: "",
      sortBy: "Name",
      character: null,
    });
    expect(thais.map((hunt) => hunt.slug)).toEqual(["cyclops"]);

    const any = filterAndSortHunts(hunts, {
      query: "",
      vocation: "Any",
      location: "Any",
      minXpH: "",
      minProfitH: "",
      minLevel: "",
      sortBy: "Name",
      character: null,
    });
    expect(any.map((hunt) => hunt.slug)).toEqual(["cyclops", "dragon"]);
  });

  it("groups several level ranges under the same vocation without mixing stats", () => {
    const mapped = mapHuntDetail({
      id: "court",
      slug: "court-of-winter",
      name: "Court of Winter",
      vocations: [
        { vocation: "ED", isRecommended: true, levelMin: 270, levelMax: 399, xpPerHour: 3_000_000, profitPerHour: 250_000 },
        { vocation: "ED", isRecommended: false, levelMin: 400, levelMax: 600, xpPerHour: 3_500_000, profitPerHour: 300_000 },
        { vocation: "MS", isRecommended: true, levelMin: 270, levelMax: 399, xpPerHour: 4_500_000, profitPerHour: 250_000 },
        { vocation: "MS", isRecommended: false, levelMin: 400, levelMax: 600, xpPerHour: 5_000_000, profitPerHour: 300_000 },
      ],
      creatures: [],
    });

    const groups = groupHuntVocations(mapped.vocations);
    expect(groups.map((group) => group.vocation)).toEqual(["ED", "MS"]);

    const ed = groups[0]!;
    expect(ed.ranges).toHaveLength(2);
    expect(ed.ranges[0]).toMatchObject({ levelMin: 270, levelMax: 399, xpPerHour: 3_000_000, profitPerHour: 250_000 });
    expect(ed.ranges[1]).toMatchObject({ levelMin: 400, levelMax: 600, xpPerHour: 3_500_000, profitPerHour: 300_000 });

    const ms = groups[1]!;
    expect(ms.ranges).toHaveLength(2);
    expect(ms.ranges[0]).toMatchObject({ xpPerHour: 4_500_000, profitPerHour: 250_000 });
    expect(ms.ranges[1]).toMatchObject({ xpPerHour: 5_000_000, profitPerHour: 300_000 });
  });

  it("does not assume every hunt has multiple ranges or every vocation", () => {
    const mapped = mapHuntDetail({
      id: "simple",
      slug: "simple-hunt",
      name: "Simple Hunt",
      vocations: [
        { vocation: "EK", isRecommended: true, levelMin: 100, levelMax: null, xpPerHour: 1_000_000, profitPerHour: 50_000 },
      ],
      creatures: [],
    });
    expect(groupHuntVocations(mapped.vocations)).toEqual([
      {
        vocation: "EK",
        ranges: [mapped.vocations[0]],
      },
    ]);
    expect(groupHuntVocations([])).toEqual([]);
  });
});

const courtRanges = [
  { vocation: "ED", isRecommended: true, levelMin: 270, levelMax: 399, xpPerHour: 3_000_000, profitPerHour: 250_000, difficulty: null, notes: null },
  { vocation: "ED", isRecommended: false, levelMin: 400, levelMax: 600, xpPerHour: 3_500_000, profitPerHour: 300_000, difficulty: null, notes: null },
  { vocation: "MS", isRecommended: true, levelMin: 270, levelMax: 399, xpPerHour: 4_500_000, profitPerHour: 250_000, difficulty: null, notes: null },
  { vocation: "MS", isRecommended: false, levelMin: 400, levelMax: 600, xpPerHour: 5_000_000, profitPerHour: 300_000, difficulty: null, notes: null },
] as const;

const courtHuntPayload = {
  id: "court",
  slug: "court-of-winter",
  name: "Court of Winter",
  vocations: [...courtRanges],
  creatures: [],
};

describe("multiple level ranges per vocation", () => {
  const character = (vocation: "ED" | "MS", level: number) => ({
    id: "c1",
    name: "Player",
    vocation,
    level,
    world: "Antica",
  });

  it("selects ED 270-399 for ED level 300", () => {
    const picked = pickHuntVocation([...courtRanges], "ED", 300);
    expect(picked).toMatchObject({ levelMin: 270, levelMax: 399, xpPerHour: 3_000_000 });
  });

  it("selects ED 400-600 for ED level 450", () => {
    const picked = pickHuntVocation([...courtRanges], "ED", 450);
    expect(picked).toMatchObject({ levelMin: 400, levelMax: 600, xpPerHour: 3_500_000 });
  });

  it("selects MS 270-399 for MS level 300", () => {
    const picked = pickHuntVocation([...courtRanges], "MS", 300);
    expect(picked).toMatchObject({ levelMin: 270, levelMax: 399, xpPerHour: 4_500_000 });
  });

  it("selects MS 400-600 for MS level 450", () => {
    const picked = pickHuntVocation([...courtRanges], "MS", 450);
    expect(picked).toMatchObject({ levelMin: 400, levelMax: 600, xpPerHour: 5_000_000 });
  });

  it("does not use MS stats when ED is preferred", () => {
    const picked = pickHuntVocation([...courtRanges], "ED", 450);
    expect(picked?.vocation).toBe("ED");
    expect(picked?.xpPerHour).not.toBe(5_000_000);
  });

  it("does not expose incompatible stats when the level is outside every range", () => {
    const mapped = mapHuntListItem(courtHuntPayload, "ED", 650);
    expect(mapped.xpH).toBeNull();
    expect(mapped.profitH).toBeNull();
  });

  it("sorts by XP using the range that matches the active character", () => {
    const low = mapHuntListItem(
      { ...courtHuntPayload, slug: "court-low", name: "Court Low" },
      "ED",
      300,
    );
    const high = mapHuntListItem(
      {
        ...courtHuntPayload,
        slug: "court-high",
        name: "Court High",
        vocations: [
          { vocation: "ED", isRecommended: true, levelMin: 270, levelMax: 399, xpPerHour: 2_000_000, profitPerHour: 100_000 },
          { vocation: "ED", isRecommended: false, levelMin: 400, levelMax: 600, xpPerHour: 6_000_000, profitPerHour: 400_000 },
        ],
      },
      "ED",
      450,
    );
    const sorted = filterAndSortHunts([low, high], {
      query: "",
      vocation: "Any",
      minXpH: "",
      minProfitH: "",
      minLevel: "",
      sortBy: "Best XP",
      character: character("ED", 450),
    });
    expect(sorted.map((hunt) => hunt.slug)).toEqual(["court-high", "court-low"]);
  });

  it("sorts by Profit using the range that matches the active character", () => {
    const hunts = [
      mapHuntListItem(courtHuntPayload, "MS", 450),
      mapHuntListItem(
        {
          ...courtHuntPayload,
          slug: "other",
          name: "Other",
          vocations: [
            { vocation: "MS", isRecommended: true, levelMin: 400, levelMax: 600, xpPerHour: 1, profitPerHour: 500_000 },
          ],
        },
        "MS",
        450,
      ),
    ];
    const sorted = filterAndSortHunts(hunts, {
      query: "",
      vocation: "Any",
      minXpH: "",
      minProfitH: "",
      minLevel: "",
      sortBy: "Best Profit",
      character: character("MS", 450),
    });
    expect(sorted[0]?.slug).toBe("other");
  });

  it("marks ED level 450 as compatible when the 400-600 range exists", () => {
    const mapped = mapHuntListItem(courtHuntPayload, "ED", 450);
    expect(huntCompatibility(mapped, character("ED", 450))).toBe(4);
    expect(mapped.xpH).toBe(3_500_000);
  });
});

describe("hunt protection elements", () => {
  function huntFromCreatures(
    creatures: Array<{ damageType?: string | null; elements?: string[]; recommendedCharm?: string | null }>,
  ) {
    return mapHuntListItem({
      id: "h1",
      slug: "test-hunt",
      name: "Test Hunt",
      creatures: creatures.map((creature, index) => ({
        name: `Creature ${index + 1}`,
        isPrimary: index === 0,
        ...creature,
      })),
    });
  }

  it("uses a single creature damage type", () => {
    const hunt = huntFromCreatures([{ damageType: "fire" }]);
    expect(huntDefenseElements(hunt)).toEqual(["fire"]);
  });

  it("aggregates different damage types across creatures", () => {
    const hunt = huntFromCreatures([
      { damageType: "fire" },
      { damageType: "death" },
      { damageType: "energy" },
    ]);
    expect(huntDefenseElements(hunt)).toEqual(["death", "energy", "fire"]);
  });

  it("deduplicates repeated damage types", () => {
    const hunt = huntFromCreatures([
      { damageType: "fire" },
      { damageType: "FIRE" },
      { damageType: "physical" },
    ]);
    expect(huntDefenseElements(hunt)).toEqual(["fire", "physical"]);
  });

  it("ignores creatures without attack damage data", () => {
    const hunt = huntFromCreatures([{ damageType: null }, { damageType: "holy" }]);
    expect(huntDefenseElements(hunt)).toEqual(["holy"]);
  });

  it("returns known elements when the composition is only partially documented", () => {
    const hunt = huntFromCreatures([
      { damageType: "ice" },
      { damageType: null },
      { damageType: "earth" },
    ]);
    expect(huntDefenseElements(hunt)).toEqual(["earth", "ice"]);
  });

  it("returns an empty list when no creature has damageType", () => {
    const hunt = huntFromCreatures([
      { damageType: null, elements: ["death"], recommendedCharm: "enflame" },
    ]);
    expect(huntDefenseElements(hunt)).toEqual([]);
    expect(huntAttackElements(hunt)).toEqual(["death", "fire"]);
  });

  it("matches list and detail mapping for the same hunt payload", () => {
    const payload = {
      id: "h1",
      slug: "court",
      name: "Court",
      creatures: [
        { name: "A", isPrimary: true, damageType: "physical" },
        { name: "B", damageType: "energy" },
      ],
    };
    expect(huntDefenseElements(mapHuntListItem(payload))).toEqual(
      huntDefenseElements(mapHuntDetail(payload)),
    );
  });

  it("maps list API creatures with damageType onto spawn for cards", () => {
    const mapped = mapHuntListItem({
      id: "h1",
      slug: "api-hunt",
      name: "API Hunt",
      bestAttack: { elements: ["FIRE"], status: "COMPLETE", creatureCount: 1, creaturesWithAnyData: 1, creaturesWithoutData: 0 },
      creatures: [
        {
          id: "c1",
          name: "Dragon",
          slug: "dragon",
          isPrimary: true,
          damageType: "FIRE",
        },
        {
          id: "c2",
          name: "Knight",
          slug: "knight",
          damageType: "PHYSICAL",
        },
      ],
    });
    expect(huntDefenseElements(mapped)).toEqual(["fire", "physical"]);
    expect(huntAttackElements(mapped)).toEqual(["fire"]);
  });
});
