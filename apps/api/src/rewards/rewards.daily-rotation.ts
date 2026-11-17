import { createHash } from 'node:crypto';
import {
  isSupportedRewardEvent,
  REWARD_EVENTS,
  type MissionPeriod,
} from './rewards.constants';

/** Daily featured missions shown to all users (global rotation). */
export const DAILY_ROTATION_SLOT_COUNT = 3;

export type DailyRotationMissionPick = {
  id: string;
  period: MissionPeriod;
  eventType: string | null;
  active: boolean;
};

export function isEligibleForDailyRotation(
  mission: DailyRotationMissionPick,
): boolean {
  if (!mission.active || mission.period !== 'DAILY') {
    return false;
  }
  const eventType = mission.eventType?.trim();
  if (!eventType || eventType === REWARD_EVENTS.WATCH_AD) {
    return false;
  }
  return isSupportedRewardEvent(eventType);
}

function rotationScore(utcPeriodDay: string, missionId: string): string {
  return createHash('sha256')
    .update(`${utcPeriodDay}\0${missionId}`)
    .digest('hex');
}

/**
 * UTC calendar day (YYYY-MM-DD) used as the rotation anchor — matches `currentPeriodWindow('DAILY')`.
 */
export function dailyRotationDayKey(periodStart: Date): string {
  return periodStart.toISOString().slice(0, 10);
}

/**
 * Deterministic global pick of up to `slotCount` distinct daily missions for `periodStart`.
 * Same inputs yield the same set for every user until the UTC day changes.
 */
export function selectDailyRotatedMissionIds(
  missions: DailyRotationMissionPick[],
  periodStart: Date,
  slotCount = DAILY_ROTATION_SLOT_COUNT,
): string[] {
  const utcPeriodDay = dailyRotationDayKey(periodStart);
  const eligible = missions.filter(isEligibleForDailyRotation);
  if (eligible.length === 0) {
    return [];
  }

  const ranked = [...eligible].sort((left, right) => {
    const byScore = rotationScore(utcPeriodDay, left.id).localeCompare(
      rotationScore(utcPeriodDay, right.id),
    );
    if (byScore !== 0) {
      return byScore;
    }
    return left.id.localeCompare(right.id);
  });

  return ranked.slice(0, Math.min(slotCount, ranked.length)).map((m) => m.id);
}