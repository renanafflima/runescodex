export type CharmGuideStepInput = {
  creatureIds: string[];
};

/**
 * Charm Points are counted once per unique creature in the guide, even when
 * the same creature appears in several steps/hunts.
 */
export function computeCharmGuideTotals(
  steps: CharmGuideStepInput[],
  charmPointsByCreatureId: Map<string, number | null | undefined>,
) {
  const seen = new Set<string>();
  let totalCharmPoints = 0;
  let occurrenceCount = 0;

  for (const step of steps) {
    for (const creatureId of step.creatureIds) {
      occurrenceCount += 1;
      if (seen.has(creatureId)) continue;
      seen.add(creatureId);
      const points = charmPointsByCreatureId.get(creatureId);
      if (typeof points === 'number' && Number.isFinite(points)) {
        totalCharmPoints += points;
      }
    }
  }

  return {
    totalCharmPoints,
    uniqueCreatureCount: seen.size,
    stepCount: steps.length,
    occurrenceCount,
  };
}

export function markRepeatedCreatures(
  steps: Array<{ creatureIds: string[] }>,
): Array<{ creatureIds: string[]; firstSeen: boolean[] }> {
  const seen = new Set<string>();
  return steps.map((step) => {
    const firstSeen = step.creatureIds.map((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    return { creatureIds: step.creatureIds, firstSeen };
  });
}
