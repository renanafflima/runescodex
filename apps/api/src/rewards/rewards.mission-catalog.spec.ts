import { MISSION_CATALOG_V2, FIXED_MISSIONS_V2, catalogRowsForSeed } from './rewards.mission-catalog';
import { IMPLEMENTED_REWARD_EVENTS } from './rewards.events';
import { selectFeaturedForPeriod } from './rewards.rotation';
import { MISSION_ROLES } from './rewards.constants';

describe('mission catalog v2', () => {
  it('defines 20 pool families with daily/weekly/monthly variants', () => {
    expect(MISSION_CATALOG_V2).toHaveLength(20);
    for (const def of MISSION_CATALOG_V2) {
      expect(def.variants).toHaveLength(3);
      expect(def.variants.map((v) => v.period).sort()).toEqual([
        'DAILY',
        'MONTHLY',
        'WEEKLY',
      ]);
    }
  });

  it('defines the three fixed missions', () => {
    expect(FIXED_MISSIONS_V2.map((m) => m.catalogKey).sort()).toEqual([
      'CODEX_LEGEND',
      'TRIBUTE_TO_GODS',
      'UNBREAKABLE_DEVOTION',
    ]);
  });

  it('seeds 63 rows (60 pool + 3 fixed) with eventImplemented from emitters', () => {
    const rows = catalogRowsForSeed();
    expect(rows).toHaveLength(63);
    const unimplementedPool = rows.filter(
      (r) => r.role === MISSION_ROLES.POOL && !r.eventImplemented,
    );
    expect(unimplementedPool.map((r) => r.catalogKey).sort()).toEqual([
      'CARTOGRAPHER',
      'CARTOGRAPHER',
      'CARTOGRAPHER',
      'DAILY_ORACLE',
      'DAILY_ORACLE',
      'DAILY_ORACLE',
      'FIELD_RATER',
      'FIELD_RATER',
      'FIELD_RATER',
      'SUPPLY_MERCHANT',
      'SUPPLY_MERCHANT',
      'SUPPLY_MERCHANT',
    ]);
    expect(
      rows.find((r) => r.catalogKey === 'TRIBUTE_TO_GODS')?.eventImplemented,
    ).toBe(false);
    expect(
      rows.find((r) => r.catalogKey === 'UNBREAKABLE_DEVOTION')
        ?.eventImplemented,
    ).toBe(true);
  });

  it('rotation only picks implemented pool missions', () => {
    const rows = catalogRowsForSeed().map((row, index) => ({
      id: `m-${index}`,
      period: row.period,
      catalogKey: row.catalogKey,
      pillar: row.pillar,
      role: row.role,
      eventType: row.eventType,
      active: row.active,
      eventImplemented: row.eventImplemented,
    }));
    const day = new Date('2026-11-17T00:00:00.000Z');
    const daily = selectFeaturedForPeriod(rows, 'DAILY', day);
    expect(daily).toHaveLength(3);
    expect(daily[0].role).toBe(MISSION_ROLES.FIXED_ADS);
    expect(daily.slice(1).every((m) => m.eventImplemented)).toBe(true);
    expect(daily.slice(1).every((m) => IMPLEMENTED_REWARD_EVENTS.has(m.eventType!))).toBe(
      true,
    );

    const weekly = selectFeaturedForPeriod(rows, 'WEEKLY', day);
    expect(weekly).toHaveLength(2);
    expect(weekly[0].role).toBe(MISSION_ROLES.FIXED_WEEKLY_STREAK);

    const monthly = selectFeaturedForPeriod(rows, 'MONTHLY', day);
    expect(monthly).toHaveLength(2);
    expect(monthly[0].role).toBe(MISSION_ROLES.FIXED_MONTHLY_STREAK);
  });
});
