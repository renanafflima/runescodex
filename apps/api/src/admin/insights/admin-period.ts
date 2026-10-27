import { BadRequestException } from '@nestjs/common';

export const PERIOD_PRESETS = [
  'today',
  '24h',
  '7d',
  '30d',
  '90d',
  'custom',
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number];
export type TimeGrain = 'hour' | 'day' | 'month';

export type ResolvedPeriod = {
  preset: PeriodPreset;
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
  grain: TimeGrain;
  /** Comparisons use elapsed time. There is no business-hours calendar. */
  clock: 'elapsed';
};

const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function resolvePeriod(
  input: {
    preset?: string;
    from?: string;
    to?: string;
  },
  now = new Date(),
): ResolvedPeriod {
  const preset = (input.preset || '30d') as PeriodPreset;
  if (!PERIOD_PRESETS.includes(preset)) {
    throw new BadRequestException('Período inválido.');
  }

  let from: Date;
  let to: Date;
  if (preset === 'custom') {
    if (!input.from || !input.to) {
      throw new BadRequestException('Informe o início e o fim do período.');
    }
    from = new Date(input.from);
    to = new Date(input.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Período inválido.');
    }
    if (to <= from) {
      throw new BadRequestException(
        'O fim do período precisa ser posterior ao início.',
      );
    }
  } else if (preset === 'today') {
    from = startOfUtcDay(now);
    to = now;
  } else if (preset === '24h') {
    to = now;
    from = new Date(now.getTime() - DAY_MS);
  } else if (preset === '7d') {
    to = now;
    from = new Date(now.getTime() - 7 * DAY_MS);
  } else if (preset === '90d') {
    to = now;
    from = new Date(now.getTime() - 90 * DAY_MS);
  } else {
    to = now;
    from = new Date(now.getTime() - 30 * DAY_MS);
  }

  const duration = to.getTime() - from.getTime();
  if (duration <= 0 || duration > MAX_RANGE_MS) {
    throw new BadRequestException('O período máximo é de 366 dias.');
  }

  const grain: TimeGrain =
    duration <= 2 * DAY_MS
      ? 'hour'
      : duration <= 120 * DAY_MS
        ? 'day'
        : 'month';

  return {
    preset,
    from,
    to,
    previousFrom: new Date(from.getTime() - duration),
    previousTo: from,
    grain,
    clock: 'elapsed',
  };
}

export function percentDelta(current: number, previous: number) {
  if (
    !Number.isFinite(current) ||
    !Number.isFinite(previous) ||
    previous === 0
  ) {
    return null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export type Measurement = 'none' | 'partial' | 'full';

/** Coverage is the timestamp of the first stored content view. */
export function measurementState(
  coverageStartedAt: Date | null,
  from: Date,
  to: Date,
): Measurement {
  if (!coverageStartedAt) return 'none';
  if (coverageStartedAt.getTime() >= to.getTime()) return 'none';
  if (coverageStartedAt.getTime() > from.getTime()) return 'partial';
  return 'full';
}

/** A missing instrumentation window is null. An observed count, including zero, is a number. */
export function observedCount(state: Measurement, count: number) {
  if (state === 'none') return null;
  return count;
}

export function truncate(date: Date, grain: TimeGrain) {
  if (grain === 'hour') {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        date.getUTCHours(),
      ),
    );
  }
  if (grain === 'day') return startOfUtcDay(date);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function addGrain(date: Date, grain: TimeGrain) {
  if (grain === 'hour') return new Date(date.getTime() + HOUR_MS);
  if (grain === 'day') return new Date(date.getTime() + DAY_MS);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

export function enumerateBuckets(from: Date, to: Date, grain: TimeGrain) {
  const buckets: Date[] = [];
  let cursor = truncate(from, grain);
  while (cursor < to && buckets.length < 400) {
    buckets.push(cursor);
    cursor = addGrain(cursor, grain);
  }
  return buckets;
}
