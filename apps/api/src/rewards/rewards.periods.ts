import type { MissionPeriod } from './rewards.constants';

const DAY_MS = 86_400_000;

export function currentPeriodWindow(period: MissionPeriod, now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const date = now.getUTCDate();
  const utcMidnight = new Date(Date.UTC(year, month, date, 0, 0, 0, 0));

  if (period === 'DAILY') {
    return {
      periodStart: utcMidnight,
      periodEnd: new Date(utcMidnight.getTime() + DAY_MS),
    };
  }

  if (period === 'WEEKLY') {
    const daysFromMonday = (utcMidnight.getUTCDay() + 6) % 7;
    const periodStart = new Date(
      utcMidnight.getTime() - daysFromMonday * DAY_MS,
    );
    return {
      periodStart,
      periodEnd: new Date(periodStart.getTime() + 7 * DAY_MS),
    };
  }

  const periodStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
  return { periodStart, periodEnd };
}
