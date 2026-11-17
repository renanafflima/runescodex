import {
  selectDailyFeatured,
  selectMonthlyFeatured,
  selectWeeklyFeatured,
  weeklyPeriodStartsInMonth,
} from './rewards.rotation';

function mission(partial: Record<string, unknown>) {
  return {
    active: true,
    eventImplemented: true,
    catalogKey: 'X',
    pillar: 'COMMUNITY',
    role: 'POOL',
    eventType: 'FORUM_TOPIC_CREATED',
    period: 'DAILY',
    ...partial,
  } as never;
}

describe('rewards rotation v2', () => {
  const day = new Date('2026-11-17T00:00:00.000Z');

  it('returns fixed ads + 2 pool dailies with distinct catalog keys', () => {
    const catalog = [
      mission({
        id: 'ads',
        role: 'FIXED_ADS',
        catalogKey: 'TRIBUTE_TO_GODS',
        eventType: 'WATCH_AD',
        eventImplemented: false,
        pillar: 'SYSTEM',
      }),
      mission({
        id: 'd1',
        catalogKey: 'TAVERN_VOICE',
        eventType: 'FORUM_COMMENT_CREATED',
        pillar: 'COMMUNITY',
      }),
      mission({
        id: 'd2',
        catalogKey: 'KINGDOM_SCRIBE',
        eventType: 'FORUM_TOPIC_CREATED',
        pillar: 'COMMUNITY',
      }),
      mission({
        id: 'd3',
        catalogKey: 'BESTIARY_SCHOLAR',
        eventType: 'CREATURE_VIEWED',
        pillar: 'BESTIARY',
      }),
      mission({
        id: 'd4',
        catalogKey: 'LAND_EXPLORER',
        eventType: 'HUNT_VIEWED',
        pillar: 'TOOLS',
      }),
    ];
    const picked = selectDailyFeatured(catalog, day);
    expect(picked.some((m) => m.id === 'ads')).toBe(true);
    const pool = picked.filter((m) => m.role === 'POOL');
    expect(pool).toHaveLength(2);
    expect(new Set(pool.map((m) => m.catalogKey)).size).toBe(2);
  });

  it('returns weekly streak + 1 pool mission', () => {
    const catalog = [
      mission({
        id: 'wfix',
        period: 'WEEKLY',
        role: 'FIXED_WEEKLY_STREAK',
        catalogKey: 'UNBREAKABLE_DEVOTION',
        eventType: 'DAILY_ALL_COMPLETED',
        pillar: 'SYSTEM',
      }),
      mission({
        id: 'w1',
        period: 'WEEKLY',
        catalogKey: 'TAVERN_VOICE',
        eventType: 'FORUM_COMMENT_CREATED',
      }),
      mission({
        id: 'w2',
        period: 'WEEKLY',
        catalogKey: 'GUIDE_MASTER',
        eventType: 'GUIDE_PUBLISHED',
        pillar: 'COMMUNITY',
      }),
    ];
    const picked = selectWeeklyFeatured(catalog, day);
    expect(picked).toHaveLength(2);
    expect(picked[0].id).toBe('wfix');
  });

  it('returns monthly streak + 1 pool mission', () => {
    const month = new Date('2026-11-01T00:00:00.000Z');
    const catalog = [
      mission({
        id: 'mfix',
        period: 'MONTHLY',
        role: 'FIXED_MONTHLY_STREAK',
        catalogKey: 'CODEX_LEGEND',
        eventType: 'WEEKLY_ALL_COMPLETED',
        pillar: 'SYSTEM',
      }),
      mission({
        id: 'm1',
        period: 'MONTHLY',
        catalogKey: 'BOSS_SLAYER',
        eventType: 'BOSS_DEFEATED_RECORDED',
        pillar: 'BOSSES',
      }),
    ];
    const picked = selectMonthlyFeatured(catalog, month);
    expect(picked.map((m) => m.id)).toEqual(['mfix', 'm1']);
  });

  it('excludes unimplemented pool missions from selection', () => {
    const catalog = [
      mission({
        id: 'ads',
        role: 'FIXED_ADS',
        catalogKey: 'TRIBUTE',
        eventImplemented: false,
      }),
      mission({
        id: 'bad',
        catalogKey: 'ORACLE',
        eventType: 'DAILY_INFO_VIEWED',
        eventImplemented: false,
      }),
      mission({
        id: 'ok',
        catalogKey: 'TAVERN_VOICE',
        eventType: 'FORUM_COMMENT_CREATED',
      }),
    ];
    const picked = selectDailyFeatured(catalog, day);
    expect(picked.map((m) => m.id)).toContain('ok');
    expect(picked.map((m) => m.id)).not.toContain('bad');
  });

  it('limits monthly week anchors to four', () => {
    const weeks = weeklyPeriodStartsInMonth(
      new Date('2026-11-01T00:00:00.000Z'),
    );
    expect(weeks.length).toBeLessThanOrEqual(4);
  });
});