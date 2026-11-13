import {
  BosstiaryAccessStatus,
  BosstiaryHuntMode,
  Difficulty,
} from '../../generated/prisma/client';
import {
  BOSSTIARY_COMBAT_STRATEGY_MARKER,
  BOSSTIARY_LOOT_STRATEGY_PREFIX,
  combineWikiStrategyField,
  mergeWikiParsedIntoExisting,
  normalizeLegacyStrategyField,
  type BosstiaryWikiParsed,
} from './bosstiary-wiki-sync';

const emptyParsed: BosstiaryWikiParsed = {
  officialCategory: null,
  bossPoints: null,
  locationName: null,
  locationRegion: null,
  originCity: null,
  howToReach: null,
  accessRequirements: null,
  accessStatus: null,
  cooldownSeconds: null,
  strategy: null,
  mechanics: null,
  recommendedLevelSolo: null,
  recommendedLevelParty: null,
  difficulty: null,
  huntMode: null,
};

describe('bosstiary wiki sync merge', () => {
  it('combines loot and combat strategy in one stored field', () => {
    const loot = `${BOSSTIARY_LOOT_STRATEGY_PREFIX} Golden Helmet`;
    const combat = 'Mantenha distância.';
  expect(combineWikiStrategyField(loot, combat)).toBe(
      `${loot}${BOSSTIARY_COMBAT_STRATEGY_MARKER}${combat}`,
    );
    expect(combineWikiStrategyField(loot, null)).toBe(loot);
    expect(combineWikiStrategyField(null, combat)).toBe(combat);
  });

  it('preserves manually reviewed fields when wiki parsing returns empty', () => {
    const existing: BosstiaryWikiParsed = {
      ...emptyParsed,
      officialCategory: 'Archfoe',
      recommendedLevelSolo: 700,
      recommendedLevelParty: 500,
      accessRequirements: 'Warlord arena.',
      accessStatus: BosstiaryAccessStatus.REQUIRED,
      strategy: 'Texto revisado manualmente.',
      difficulty: Difficulty.VERY_HARD,
      huntMode: BosstiaryHuntMode.PARTY,
    };
    const merged = mergeWikiParsedIntoExisting(existing, emptyParsed);
    expect(merged).toEqual(existing);
  });

  it('fills missing fields from wiki without dropping non-null review data', () => {
    const existing: BosstiaryWikiParsed = {
      ...emptyParsed,
      recommendedLevelSolo: 500,
      strategy: 'Estratégia editorial.',
    };
    const parsed: BosstiaryWikiParsed = {
      ...emptyParsed,
      locationName: 'Hellgorge',
      mechanics: 'Habilidades: rush',
      recommendedLevelParty: 300,
    };
    const merged = mergeWikiParsedIntoExisting(existing, parsed);
    expect(merged.recommendedLevelSolo).toBe(500);
    expect(merged.strategy).toBe('Estratégia editorial.');
    expect(merged.locationName).toBe('Hellgorge');
    expect(merged.mechanics).toBe('Habilidades: rush');
    expect(merged.recommendedLevelParty).toBe(300);
  });

  it('preserves manual access requirements when wiki says no quest', () => {
    const existing: BosstiaryWikiParsed = {
      ...emptyParsed,
      accessRequirements: 'Grave Danger Quest',
      accessStatus: BosstiaryAccessStatus.REQUIRED,
    };
    const parsed: BosstiaryWikiParsed = {
      ...emptyParsed,
      accessStatus: BosstiaryAccessStatus.NONE,
      accessRequirements: null,
    };
    const merged = mergeWikiParsedIntoExisting(existing, parsed);
    expect(merged.accessRequirements).toBe('Grave Danger Quest');
    expect(merged.accessStatus).toBe(BosstiaryAccessStatus.REQUIRED);
  });

  it('normalizes legacy mixed strategy prose', () => {
    const mixed =
      'O EK deve manter o boss trapado. Drops principais: Shiny Blade, Mycological Bow, Gill Coat.';
    expect(normalizeLegacyStrategyField(mixed)).toBe(
      `${BOSSTIARY_LOOT_STRATEGY_PREFIX} Shiny Blade, Mycological Bow, Gill Coat${BOSSTIARY_COMBAT_STRATEGY_MARKER}O EK deve manter o boss trapado.`,
    );
  });
});
