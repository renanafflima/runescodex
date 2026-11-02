import {
  mapHuntCreatureBestiary,
  resolveHuntCreatureHours,
  summarizeHuntBestiary,
} from './hunt-bestiary';

describe('hunt-bestiary', () => {
  const entry = {
    category: 'Medium',
    killsRequired: 1000,
    estimatedKillsPerHour: null as number | null,
    charmPoints: 25,
  };

  it('prefers hunt kill per hour over bestiary entry rate', () => {
    expect(
      resolveHuntCreatureHours(1000, 250, 100),
    ).toEqual({
      estimatedHours: 4,
      hoursEstimateSource: 'HUNT_CREATURE',
      killsPerHourUsed: 250,
    });
  });

  it('falls back to bestiary entry rate when hunt rate is missing', () => {
    expect(
      resolveHuntCreatureHours(1000, null, 200),
    ).toEqual({
      estimatedHours: 5,
      hoursEstimateSource: 'BESTIARY_ENTRY',
      killsPerHourUsed: 200,
    });
  });

  it('returns null hours when no rate is available', () => {
    expect(resolveHuntCreatureHours(1000, null, null)).toEqual({
      estimatedHours: null,
      hoursEstimateSource: null,
      killsPerHourUsed: null,
    });
  });

  it('maps creature without bestiary entry', () => {
    expect(mapHuntCreatureBestiary(null, 100)).toEqual({
      hasEntry: false,
      category: null,
      killsRequired: null,
      charmPoints: null,
      estimatedKillsPerHour: null,
      estimatedHours: null,
      hoursEstimateSource: null,
      killsPerHourUsed: null,
    });
  });

  it('summarizes charm points and partial hours across creatures', () => {
    const summary = summarizeHuntBestiary([
      mapHuntCreatureBestiary(
        { ...entry, charmPoints: 10, estimatedKillsPerHour: 100 },
        null,
      ),
      mapHuntCreatureBestiary(
        {
          category: 'Hard',
          killsRequired: 500,
          estimatedKillsPerHour: null,
          charmPoints: 15,
        },
        250,
      ),
      mapHuntCreatureBestiary(null, null),
    ]);
    expect(summary.totalCharmPoints).toBe(25);
    expect(summary.creaturesWithEntry).toBe(2);
    expect(summary.creatureCount).toBe(3);
    expect(summary.totalEstimatedHours).toBe(12);
    expect(summary.estimatedHoursCreatureCount).toBe(2);
  });
});
