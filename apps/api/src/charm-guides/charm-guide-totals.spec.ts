import {
  computeCharmGuideTotals,
  markRepeatedCreatures,
} from './charm-guide-totals';

describe('charm-guide-totals', () => {
  const points = new Map<string, number>([
    ['a', 15],
    ['b', 25],
    ['c', 50],
  ]);

  it('sums charm points once per unique creature across steps', () => {
    const totals = computeCharmGuideTotals(
      [
        { creatureIds: ['a', 'b'] },
        { creatureIds: ['b', 'c'] },
      ],
      points,
    );
    expect(totals).toEqual({
      totalCharmPoints: 90,
      uniqueCreatureCount: 3,
      stepCount: 2,
      occurrenceCount: 4,
    });
  });

  it('ignores missing charm point entries without inventing values', () => {
    const totals = computeCharmGuideTotals(
      [{ creatureIds: ['a', 'missing'] }],
      points,
    );
    expect(totals.totalCharmPoints).toBe(15);
    expect(totals.uniqueCreatureCount).toBe(2);
  });

  it('marks later occurrences of the same creature as repeated', () => {
    const marked = markRepeatedCreatures([
      { creatureIds: ['a', 'b'] },
      { creatureIds: ['b', 'c'] },
    ]);
    expect(marked[0]?.firstSeen).toEqual([true, true]);
    expect(marked[1]?.firstSeen).toEqual([false, true]);
  });
});
