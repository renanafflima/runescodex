export type HoursEstimateSource = 'HUNT_CREATURE' | 'BESTIARY_ENTRY' | null;

export type BestiaryEntrySnapshot = {
  category: string | null;
  killsRequired: number;
  estimatedKillsPerHour: number | null;
  charmPoints: number | null;
};

export type HuntCreatureBestiaryDto = {
  hasEntry: boolean;
  category: string | null;
  killsRequired: number | null;
  charmPoints: number | null;
  /** Global reference rate from BestiaryEntry (not hunt-specific). */
  estimatedKillsPerHour: number | null;
  estimatedHours: number | null;
  hoursEstimateSource: HoursEstimateSource;
  killsPerHourUsed: number | null;
};

export type HuntBestiarySummaryDto = {
  totalCharmPoints: number;
  creaturesWithEntry: number;
  creatureCount: number;
  totalEstimatedHours: number | null;
  estimatedHoursCreatureCount: number;
};

export function resolveHuntCreatureHours(
  killsRequired: number | null | undefined,
  huntKillPerHour: number | null | undefined,
): {
  estimatedHours: number | null;
  hoursEstimateSource: HoursEstimateSource;
  killsPerHourUsed: number | null;
} {
  if (killsRequired == null) {
    return {
      estimatedHours: null,
      hoursEstimateSource: null,
      killsPerHourUsed: null,
    };
  }
  if (huntKillPerHour != null && huntKillPerHour > 0) {
    return {
      estimatedHours: Math.ceil(killsRequired / huntKillPerHour),
      hoursEstimateSource: 'HUNT_CREATURE',
      killsPerHourUsed: huntKillPerHour,
    };
  }
  return {
    estimatedHours: null,
    hoursEstimateSource: null,
    killsPerHourUsed: null,
  };
}

export function mapHuntCreatureBestiary(
  entry: BestiaryEntrySnapshot | null | undefined,
  huntKillPerHour: number | null | undefined,
): HuntCreatureBestiaryDto {
  if (!entry) {
    return {
      hasEntry: false,
      category: null,
      killsRequired: null,
      charmPoints: null,
      estimatedKillsPerHour: null,
      estimatedHours: null,
      hoursEstimateSource: null,
      killsPerHourUsed: null,
    };
  }
  const hours = resolveHuntCreatureHours(entry.killsRequired, huntKillPerHour);
  return {
    hasEntry: true,
    category: entry.category,
    killsRequired: entry.killsRequired,
    charmPoints: entry.charmPoints,
    estimatedKillsPerHour: entry.estimatedKillsPerHour,
    estimatedHours: hours.estimatedHours,
    hoursEstimateSource: hours.hoursEstimateSource,
    killsPerHourUsed: hours.killsPerHourUsed,
  };
}

export function summarizeHuntBestiary(
  rows: HuntCreatureBestiaryDto[],
): HuntBestiarySummaryDto {
  const creatureCount = rows.length;
  const withEntry = rows.filter((row) => row.hasEntry);
  const totalCharmPoints = withEntry.reduce(
    (sum, row) => sum + (row.charmPoints ?? 0),
    0,
  );
  const withHours = withEntry.filter(
    (row) => row.estimatedHours != null && row.estimatedHours > 0,
  );
  const totalEstimatedHours = withHours.length
    ? withHours.reduce((sum, row) => sum + (row.estimatedHours ?? 0), 0)
    : null;

  return {
    totalCharmPoints,
    creaturesWithEntry: withEntry.length,
    creatureCount,
    totalEstimatedHours,
    estimatedHoursCreatureCount: withHours.length,
  };
}
