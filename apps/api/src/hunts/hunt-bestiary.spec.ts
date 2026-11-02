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
    expect(resolveHuntCreatureHours(1000, 250)).toEqual({
      estimatedHours: 4,
      hoursEstimateSource: 'HUNT_CREATURE',
      killsPerHourUsed: 250,
    });
  });

  it('does not use bestiary entry rate when hunt rate is missing', () => {
    expect(resolveHuntCreatureHours(1000, null)).toEqual({
      estimatedHours: null,
      hoursEstimateSource: null,
      killsPerHourUsed: null,
    });
  });

  it('does not calculate when hunt kill per hour is zero', () => {
    expect(resolveHuntCreatureHours(2500, 0)).toEqual({
      estimatedHours: null,
      hoursEstimateSource: null,
      killsPerHourUsed: null,
    });
  });

  it('calculates completion hours from hunt kill per hour', () => {
    expect(resolveHuntCreatureHours(2500, 250)).toEqual({
      estimatedHours: 10,
      hoursEstimateSource: 'HUNT_CREATURE',
      killsPerHourUsed: 250,
    });
  });

  it('returns null hours when no rate is available', () => {
    expect(resolveHuntCreatureHours(1000, null)).toEqual({
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
    expect(summary.totalEstimatedHours).toBe(2);
    expect(summary.estimatedHoursCreatureCount).toBe(1);
  });
});
