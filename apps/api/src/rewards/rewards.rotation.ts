import { createHash } from 'node:crypto';
import { MISSION_ROLES } from './rewards.constants';
import type { MissionPeriod } from './rewards.constants';

export type RotationMissionPick = {
  id: string;
  period: MissionPeriod;
  catalogKey: string | null;
  pillar: string | null;
  role: string;
  eventType: string | null;
  active: boolean;
  eventImplemented: boolean;
};

function score(cycleKey: string, missionId: string): string {
  return createHash('sha256')
    .update(`${cycleKey}\0${missionId}`)
    .digest('hex');
}

export function cycleKeyForPeriod(
  period: MissionPeriod,
  periodStart: Date,
): string {
  if (period === 'DAILY') {
    return `D:${periodStart.toISOString().slice(0, 10)}`;
  }
  if (period === 'WEEKLY') {
    return `W:${periodStart.toISOString().slice(0, 10)}`;
  }
  return `M:${periodStart.toISOString().slice(0, 7)}`;
}

function poolEligible(m: RotationMissionPick, period: MissionPeriod): boolean {
  return (
    m.active &&
    m.period === period &&
    m.role === MISSION_ROLES.POOL &&
    m.eventImplemented &&
    Boolean(m.eventType) &&
    Boolean(m.catalogKey)
  );
}

function pickDistinct(
  candidates: RotationMissionPick[],
  cycleKey: string,
  count: number,
  usedCatalogKeys: Set<string>,
  usedPillars: Set<string>,
): RotationMissionPick[] {
  const ranked = [...candidates].sort((a, b) => {
    const byScore = score(cycleKey, a.id).localeCompare(score(cycleKey, b.id));
    if (byScore !== 0) return byScore;
    return a.id.localeCompare(b.id);
  });

  const picked: RotationMissionPick[] = [];
  for (const mission of ranked) {
    if (picked.length >= count) break;
    const key = mission.catalogKey ?? mission.id;
    const pillar = mission.pillar ?? key;
    if (usedCatalogKeys.has(key)) continue;
    if (usedPillars.has(pillar) && count > 1) {
      // Prefer different pillars when filling multiple slots; allow if pool exhausted later.
      continue;
    }
    picked.push(mission);
    usedCatalogKeys.add(key);
    usedPillars.add(pillar);
  }

  // Second pass without pillar constraint if short.
  if (picked.length < count) {
    for (const mission of ranked) {
      if (picked.length >= count) break;
      const key = mission.catalogKey ?? mission.id;
      if (usedCatalogKeys.has(key)) continue;
      if (picked.some((p) => p.id === mission.id)) continue;
      picked.push(mission);
      usedCatalogKeys.add(key);
    }
  }

  return picked;
}

export function selectDailyFeatured(
  missions: RotationMissionPick[],
  periodStart: Date,
): RotationMissionPick[] {
  const cycleKey = cycleKeyForPeriod('DAILY', periodStart);
  const fixedAds = missions.find(
    (m) =>
      m.active &&
      m.period === 'DAILY' &&
      m.role === MISSION_ROLES.FIXED_ADS,
  );
  const pool = missions.filter((m) => poolEligible(m, 'DAILY'));
  const usedKeys = new Set<string>();
  const usedPillars = new Set<string>();
  const variables = pickDistinct(pool, cycleKey, 2, usedKeys, usedPillars);

  const result: RotationMissionPick[] = [];
  if (fixedAds) result.push(fixedAds);
  result.push(...variables);
  return result;
}

export function selectWeeklyFeatured(
  missions: RotationMissionPick[],
  periodStart: Date,
): RotationMissionPick[] {
  const cycleKey = cycleKeyForPeriod('WEEKLY', periodStart);
  const fixed = missions.find(
    (m) =>
      m.active &&
      m.period === 'WEEKLY' &&
      m.role === MISSION_ROLES.FIXED_WEEKLY_STREAK,
  );
  const pool = missions.filter((m) => poolEligible(m, 'WEEKLY'));
  const variables = pickDistinct(
    pool,
    cycleKey,
    1,
    new Set(),
    new Set(),
  );
  const result: RotationMissionPick[] = [];
  if (fixed) result.push(fixed);
  result.push(...variables);
  return result;
}

export function selectMonthlyFeatured(
  missions: RotationMissionPick[],
  periodStart: Date,
): RotationMissionPick[] {
  const cycleKey = cycleKeyForPeriod('MONTHLY', periodStart);
  const fixed = missions.find(
    (m) =>
      m.active &&
      m.period === 'MONTHLY' &&
      m.role === MISSION_ROLES.FIXED_MONTHLY_STREAK,
  );
  const pool = missions.filter((m) => poolEligible(m, 'MONTHLY'));
  const variables = pickDistinct(
    pool,
    cycleKey,
    1,
    new Set(),
    new Set(),
  );
  const result: RotationMissionPick[] = [];
  if (fixed) result.push(fixed);
  result.push(...variables);
  return result;
}

export function selectFeaturedForPeriod(
  missions: RotationMissionPick[],
  period: MissionPeriod,
  periodStart: Date,
): RotationMissionPick[] {
  if (period === 'DAILY') return selectDailyFeatured(missions, periodStart);
  if (period === 'WEEKLY') return selectWeeklyFeatured(missions, periodStart);
  return selectMonthlyFeatured(missions, periodStart);
}

/**
 * Months can contain 4 or 5 Monday-start UTC weeks.
 * Lenda do Codex requires exactly 4 completed WEEKLY_ALL cycles whose
 * periodStart falls in [monthStart, monthEnd). Extra 5th week is ignored for the streak.
 */
export function weeklyPeriodStartsInMonth(monthStart: Date): Date[] {
  const year = monthStart.getUTCFullYear();
  const month = monthStart.getUTCMonth();
  const monthEnd = new Date(Date.UTC(year, month + 1, 1));
  const first = new Date(Date.UTC(year, month, 1));
  const day = first.getUTCDay();
  const daysFromMonday = (day + 6) % 7;
  let weekStart = new Date(first.getTime() - daysFromMonday * 86_400_000);
  const weeks: Date[] = [];
  while (weekStart < monthEnd) {
    // Count week if its Monday is in this month OR the week overlaps the month and Monday is previous month's tail — only Mondays that fall inside the month OR the first week that overlaps day 1.
    const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);
    if (weekEnd > first && weekStart < monthEnd) {
      weeks.push(new Date(weekStart));
    }
    weekStart = weekEnd;
  }
  return weeks.slice(0, 4);
}