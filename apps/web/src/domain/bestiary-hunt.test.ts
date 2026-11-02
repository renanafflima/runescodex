import { describe, expect, it } from "vitest";
import {
  bestiarySpawnStatLines,
  formatBestiaryEstimatedDuration,
  huntSpawnCreature,
  summarizeBestiaryHuntsForCreature,
} from "./bestiary-hunt";
import type { HuntListItem } from "../services/api/types";

const huntA: HuntListItem = {
  id: "h1",
  slug: "hunt-a",
  name: "Hunt A",
  location: null,
  subLocation: null,
  displayLocation: "A",
  difficulty: null,
  respawn: null,
  vocations: [],
  creature: "Dragon",
  creatureImage: null,
  xpH: null,
  profitH: null,
  levelMin: null,
  levelMax: null,
  vocation: null,
  mapImage: null,
  youtubeUrl: null,
  bestAttack: null,
  bestiarySummary: {
    totalCharmPoints: 0,
    creaturesWithEntry: 0,
    creatureCount: 0,
    totalEstimatedHours: null,
    estimatedHoursCreatureCount: 0,
  },
  spawn: [
    {
      id: "c1",
      slug: "dragon",
      name: "Dragon",
      image: null,
      hp: null,
      xp: null,
      elements: [],
      recommendedCharm: null,
      damageType: null,
      killPerHour: 250,
      isPrimary: true,
      quantity: null,
      notes: null,
      catalogDifficulty: null,
      bestiary: {
        hasEntry: true,
        category: "Hard",
        killsRequired: 2500,
        charmPoints: 50,
        estimatedKillsPerHour: null,
        estimatedHours: 10,
        hoursEstimateSource: "HUNT_CREATURE",
        killsPerHourUsed: 250,
      },
    },
  ],
};

const huntB: HuntListItem = {
  ...huntA,
  id: "h2",
  slug: "hunt-b",
  name: "Hunt B",
  spawn: [
    {
      ...huntA.spawn[0]!,
      killPerHour: 500,
      bestiary: {
        ...huntA.spawn[0]!.bestiary,
        estimatedHours: 5,
        killsPerHourUsed: 500,
      },
    },
  ],
};

describe("bestiary hunt completion time", () => {
  it("formats human-readable duration", () => {
    expect(formatBestiaryEstimatedDuration(10)).toBe("10 horas");
    expect(formatBestiaryEstimatedDuration(1)).toBe("1 hora");
    expect(formatBestiaryEstimatedDuration(null)).toBe("Tempo não estimado");
    expect(formatBestiaryEstimatedDuration(0)).toBe("Tempo não estimado");
  });

  it("builds stat lines from hunt-specific kill per hour", () => {
    const lines = bestiarySpawnStatLines(huntA.spawn[0]!);
    expect(lines.map((line) => line.text)).toEqual([
      "2500 kills necessárias",
      "50 Charm Points",
      "250 kills/h",
      "Tempo estimado: 10 horas",
    ]);
  });

  it("uses different rates for the same creature across hunts", () => {
    expect(huntSpawnCreature(huntA, "dragon")?.bestiary.estimatedHours).toBe(10);
    expect(huntSpawnCreature(huntB, "dragon")?.bestiary.estimatedHours).toBe(5);
  });

  it("counts hunts with calculable time without summing hours", () => {
    expect(summarizeBestiaryHuntsForCreature([huntA, huntB], "dragon")).toEqual({
      huntCount: 2,
      huntsWithEstimatedTime: 2,
    });
  });

  it("reports missing bestiary entry and unknown time without a hunt rate", () => {
    const creature = {
      ...huntA.spawn[0]!,
      killPerHour: null,
      bestiary: { ...emptyHuntBestiary },
    };
    expect(bestiarySpawnStatLines(creature).map((line) => line.text)).toEqual([
      "Bestiário não cadastrado",
    ]);

    const withoutRate = {
      ...huntA.spawn[0]!,
      killPerHour: null,
      bestiary: {
        ...huntA.spawn[0]!.bestiary,
        estimatedHours: null,
        killsPerHourUsed: null,
        hoursEstimateSource: null,
      },
    };
    expect(bestiarySpawnStatLines(withoutRate).at(-1)?.text).toBe("Tempo estimado: Tempo não estimado");
  });
});

const emptyHuntBestiary = {
  hasEntry: false,
  category: null,
  killsRequired: null,
  charmPoints: null,
  estimatedKillsPerHour: null,
  estimatedHours: null,
  hoursEstimateSource: null,
  killsPerHourUsed: null,
} as const;
