import {
  DAILY_ROTATION_SLOT_COUNT,
  isEligibleForDailyRotation,
  selectDailyRotatedMissionIds,
} from './rewards.daily-rotation';
import { currentPeriodWindow } from './rewards.periods';

const dayA = new Date('2026-11-15T00:00:00.000Z');
const dayB = new Date('2026-11-16T00:00:00.000Z');

const catalog = [
  {
    id: 'm-forum-topic',
    period: 'DAILY' as const,
    eventType: 'FORUM_TOPIC_CREATED',
    active: true,
  },
  {
    id: 'm-forum-comment',
    period: 'DAILY' as const,
    eventType: 'FORUM_COMMENT_CREATED',
    active: true,
  },
  {
    id: 'm-bosstiary',
    period: 'DAILY' as const,
    eventType: 'BOSSTIARY_COMMUNITY_ROTATION_PUBLISHED',
    active: true,
  },
  {
    id: 'm-watch-ad',
    period: 'DAILY' as const,
    eventType: 'WATCH_AD',
    active: true,
  },
  {
    id: 'm-hunt',
    period: 'DAILY' as const,
    eventType: 'HUNT_CREATED',
    active: true,
  },
  {
    id: 'm-weekly',
    period: 'WEEKLY' as const,
    eventType: 'FORUM_TOPIC_CREATED',
    active: true,
  },
];

describe('daily mission rotation', () => {
  it('excludes WATCH_AD, non-daily, inactive and unsupported events', () => {
    expect(isEligibleForDailyRotation(catalog[0])).toBe(true);
    expect(isEligibleForDailyRotation(catalog[3])).toBe(false);
    expect(isEligibleForDailyRotation(catalog[4])).toBe(false);
    expect(isEligibleForDailyRotation(catalog[5])).toBe(false);
    expect(
      isEligibleForDailyRotation({
        id: 'off',
        period: 'DAILY',
        eventType: 'FORUM_TOPIC_CREATED',
        active: false,
      }),
    ).toBe(false);
  });

  it('picks exactly three distinct eligible missions when the catalog is large enough', () => {
    const ids = selectDailyRotatedMissionIds(catalog, dayA);
    expect(ids).toHaveLength(DAILY_ROTATION_SLOT_COUNT);
    expect(new Set(ids).size).toBe(DAILY_ROTATION_SLOT_COUNT);
    expect(ids).not.toContain('m-watch-ad');
    expect(ids).not.toContain('m-hunt');
  });

  it('keeps the same selection stable within the same UTC day', () => {
    const morning = new Date('2026-11-15T08:30:00.000Z');
    const evening = new Date('2026-11-15T23:59:00.000Z');
    const startMorning = currentPeriodWindow('DAILY', morning).periodStart;
    const startEvening = currentPeriodWindow('DAILY', evening).periodStart;
    expect(selectDailyRotatedMissionIds(catalog, startMorning)).toEqual(
      selectDailyRotatedMissionIds(catalog, startEvening),
    );
  });

  it('changes the selection on the next UTC day when enough options exist', () => {
    const idsA = selectDailyRotatedMissionIds(catalog, dayA);
    const idsB = selectDailyRotatedMissionIds(catalog, dayB);
    expect(idsA).not.toEqual(idsB);
  });

  it('returns fewer than three when the eligible catalog is smaller', () => {
    const small = catalog.filter((m) =>
      ['m-forum-topic', 'm-forum-comment'].includes(m.id),
    );
    expect(selectDailyRotatedMissionIds(small, dayA)).toEqual([
      'm-forum-topic',
      'm-forum-comment',
    ]);
  });

  it('is reproducible for the same date and mission ids', () => {
    expect(selectDailyRotatedMissionIds(catalog, dayA)).toEqual(
      selectDailyRotatedMissionIds(catalog, dayA),
    );
  });
});