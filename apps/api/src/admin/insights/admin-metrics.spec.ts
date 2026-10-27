import { measurementState, observedCount, percentDelta } from './admin-period';

describe('metric comparisons', () => {
  it('does not invent a percentage when the previous value is zero', () => {
    expect(percentDelta(4, 0)).toBeNull();
    expect(percentDelta(12, 8)).toBe(50);
  });

  it('keeps an observed zero distinct from a period without instrumentation', () => {
    const from = new Date('2026-10-01T00:00:00.000Z');
    const to = new Date('2026-10-20T00:00:00.000Z');
    expect(measurementState(null, from, to)).toBe('none');
    expect(observedCount('none', 0)).toBeNull();
    expect(
      measurementState(new Date('2026-09-01T00:00:00.000Z'), from, to),
    ).toBe('full');
    expect(observedCount('full', 0)).toBe(0);
    expect(
      measurementState(new Date('2026-10-10T00:00:00.000Z'), from, to),
    ).toBe('partial');
    expect(
      measurementState(new Date('2026-11-01T00:00:00.000Z'), from, to),
    ).toBe('none');
  });
});
