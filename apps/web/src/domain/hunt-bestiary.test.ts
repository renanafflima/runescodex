import { describe, expect, it } from "vitest";
import {
  formatHuntBestiaryHoursLabel,
  formatHuntCardBestiaryLines,
  formatHuntCardBestiarySummary,
  mapHuntCreatureBestiary,
} from "./hunt-bestiary";

describe("hunt-bestiary domain", () => {
  it("maps API bestiary payload for a creature with entry and hunt rate", () => {
    const mapped = mapHuntCreatureBestiary({
      hasEntry: true,
      category: "Medium",
      killsRequired: 1000,
      charmPoints: 25,
      estimatedKillsPerHour: null,
      estimatedHours: 4,
      hoursEstimateSource: "HUNT_CREATURE",
      killsPerHourUsed: 250,
    });
    expect(mapped.killsRequired).toBe(1000);
    expect(mapped.charmPoints).toBe(25);
    expect(formatHuntBestiaryHoursLabel(mapped)).toContain("≈ 4h");
    expect(formatHuntBestiaryHoursLabel(mapped)).toContain("estimativa da hunt");
  });

  it('shows "Tempo não estimado" when entry exists without rate', () => {
    const mapped = mapHuntCreatureBestiary({
      hasEntry: true,
      category: "Easy",
      killsRequired: 500,
      charmPoints: 5,
      estimatedKillsPerHour: null,
      estimatedHours: null,
      hoursEstimateSource: null,
      killsPerHourUsed: null,
    });
    expect(formatHuntBestiaryHoursLabel(mapped)).toBe("Tempo não estimado");
  });

  it("summarizes card bestiary strip", () => {
    const card = formatHuntCardBestiarySummary({
      totalCharmPoints: 40,
      creaturesWithEntry: 2,
      creatureCount: 3,
      totalEstimatedHours: 7,
      estimatedHoursCreatureCount: 1,
    });
    expect(card?.charms).toBe("40");
    expect(card?.creatures).toBe("2/3 bestiário");
  });

  it("returns null card summary when no bestiary entries", () => {
    expect(
      formatHuntCardBestiarySummary({
        totalCharmPoints: 0,
        creaturesWithEntry: 0,
        creatureCount: 4,
        totalEstimatedHours: null,
        estimatedHoursCreatureCount: 0,
      }),
    ).toBeNull();
  });

  it("formats the two compact card lines for a complete bestiary", () => {
    const lines = formatHuntCardBestiaryLines({
      totalCharmPoints: 275,
      creaturesWithEntry: 6,
      creatureCount: 6,
      totalEstimatedHours: null,
      estimatedHoursCreatureCount: 0,
    });
    expect(lines?.bestiaryLine).toBe("Bestiário: 6/6");
    expect(lines?.charmLine).toBe("Charm Points: 275");
  });

  it("formats the card lines for an incomplete bestiary", () => {
    const lines = formatHuntCardBestiaryLines({
      totalCharmPoints: 90,
      creaturesWithEntry: 2,
      creatureCount: 5,
      totalEstimatedHours: null,
      estimatedHoursCreatureCount: 0,
    });
    expect(lines?.bestiaryLine).toBe("Bestiário: 2/5");
    expect(lines?.charmLine).toBe("Charm Points: 90");
  });

  it("returns null card lines when no bestiary entries exist", () => {
    expect(
      formatHuntCardBestiaryLines({
        totalCharmPoints: 0,
        creaturesWithEntry: 0,
        creatureCount: 3,
        totalEstimatedHours: null,
        estimatedHoursCreatureCount: 0,
      }),
    ).toBeNull();
  });
});
