import { formatEstimatedHours } from "./bestiary";
import { formatCount, formatDifficultyLabel, hasNumericValue } from "./format";

export type HuntCreatureBestiary = {
  hasEntry: boolean;
  category: string | null;
  killsRequired: number | null;
  charmPoints: number | null;
  estimatedKillsPerHour: number | null;
  estimatedHours: number | null;
  hoursEstimateSource: "HUNT_CREATURE" | "BESTIARY_ENTRY" | null;
  killsPerHourUsed: number | null;
};

export type HuntBestiarySummary = {
  totalCharmPoints: number;
  creaturesWithEntry: number;
  creatureCount: number;
  totalEstimatedHours: number | null;
  estimatedHoursCreatureCount: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function mapHuntCreatureBestiary(value: unknown): HuntCreatureBestiary {
  const data = asRecord(value);
  return {
    hasEntry: Boolean(data.hasEntry),
    category: typeof data.category === "string" ? data.category : null,
    killsRequired: hasNumericValue(data.killsRequired) ? Number(data.killsRequired) : null,
    charmPoints: hasNumericValue(data.charmPoints) ? Number(data.charmPoints) : null,
    estimatedKillsPerHour: hasNumericValue(data.estimatedKillsPerHour)
      ? Number(data.estimatedKillsPerHour)
      : null,
    estimatedHours: hasNumericValue(data.estimatedHours) ? Number(data.estimatedHours) : null,
    hoursEstimateSource:
      data.hoursEstimateSource === "HUNT_CREATURE" ||
      data.hoursEstimateSource === "BESTIARY_ENTRY"
        ? data.hoursEstimateSource
        : null,
    killsPerHourUsed: hasNumericValue(data.killsPerHourUsed) ? Number(data.killsPerHourUsed) : null,
  };
}

export function mapHuntBestiarySummary(value: unknown): HuntBestiarySummary {
  const data = asRecord(value);
  return {
    totalCharmPoints: hasNumericValue(data.totalCharmPoints) ? Number(data.totalCharmPoints) : 0,
    creaturesWithEntry: hasNumericValue(data.creaturesWithEntry) ? Number(data.creaturesWithEntry) : 0,
    creatureCount: hasNumericValue(data.creatureCount) ? Number(data.creatureCount) : 0,
    totalEstimatedHours: hasNumericValue(data.totalEstimatedHours)
      ? Number(data.totalEstimatedHours)
      : null,
    estimatedHoursCreatureCount: hasNumericValue(data.estimatedHoursCreatureCount)
      ? Number(data.estimatedHoursCreatureCount)
      : 0,
  };
}

export function formatBestiaryDifficultyLabel(
  bestiary: HuntCreatureBestiary,
  creatureDifficulty: string | null | undefined,
) {
  if (bestiary.category?.trim()) return bestiary.category.trim();
  return formatDifficultyLabel(creatureDifficulty) || null;
}

export function formatHuntBestiaryHoursLabel(bestiary: HuntCreatureBestiary) {
  const formatted = formatEstimatedHours(bestiary.estimatedHours);
  if (formatted) {
    const source =
      bestiary.hoursEstimateSource === "HUNT_CREATURE"
        ? "estimativa da hunt"
        : bestiary.hoursEstimateSource === "BESTIARY_ENTRY"
          ? "referência do bestiário"
          : null;
    return source ? `${formatted} (${source})` : formatted;
  }
  if (bestiary.hasEntry && bestiary.killsRequired != null) {
    return "Tempo não estimado";
  }
  return null;
}

export function formatHuntCardBestiarySummary(summary: HuntBestiarySummary) {
  if (!summary.creaturesWithEntry) {
    return null;
  }
  const charms = formatCount(summary.totalCharmPoints) ?? "0";
  const creatures = `${summary.creaturesWithEntry}/${summary.creatureCount} bestiário`;
  return {
    charms,
    creatures,
  };
}

/**
 * Same numbers as formatHuntCardBestiarySummary, split into the two compact
 * lines used on the Hunts list cards ("Bestiário: x/y" and "Charm Points: n").
 * Presentation only — does not recompute bestiary or charm point values.
 */
export function formatHuntCardBestiaryLines(summary: HuntBestiarySummary) {
  if (!summary.creaturesWithEntry) {
    return null;
  }
  const charms = formatCount(summary.totalCharmPoints) ?? "0";
  return {
    bestiaryLine: `Bestiário: ${summary.creaturesWithEntry}/${summary.creatureCount}`,
    charmLine: `Charm Points: ${charms}`,
  };
}
