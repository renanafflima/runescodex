import { BadRequestException } from '@nestjs/common';
import { resolvePeriod } from './admin-period';

describe('admin period', () => {
  const now = new Date('2026-10-20T15:30:00.000Z');

  it('uses the previous window of the same length', () => {
    const period = resolvePeriod({ preset: '7d' }, now);
    expect(period.to.toISOString()).toBe(now.toISOString());
    expect(period.previousTo.toISOString()).toBe(period.from.toISOString());
    expect(period.from.getTime() - period.previousFrom.getTime()).toBe(
      period.to.getTime() - period.from.getTime(),
    );
    expect(period.grain).toBe('day');
    expect(period.clock).toBe('elapsed');
  });

  it('uses hours for a short window and months for a long one', () => {
    expect(resolvePeriod({ preset: '24h' }, now).grain).toBe('hour');
    const custom = resolvePeriod(
      {
        preset: 'custom',
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-08-01T00:00:00.000Z',
      },
      now,
    );
    expect(custom.grain).toBe('month');
  });

  it('rejects an inverted or oversized custom range', () => {
    expect(() =>
      resolvePeriod(
        {
          preset: 'custom',
          from: '2026-10-02T00:00:00.000Z',
          to: '2026-10-01T00:00:00.000Z',
        },
        now,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      resolvePeriod(
        {
          preset: 'custom',
          from: '2024-01-01T00:00:00.000Z',
          to: '2026-10-01T00:00:00.000Z',
        },
        now,
      ),
    ).toThrow(BadRequestException);
  });
});
