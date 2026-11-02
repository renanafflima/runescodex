import { describe, expect, it } from "vitest";
import {
  formatHuntBestiaryHoursLabel,
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
});
