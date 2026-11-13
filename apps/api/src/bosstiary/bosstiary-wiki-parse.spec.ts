import { validateWikiPageTitle } from './bosstiary-wiki-parse';
import { BOSSTIARY_LOOT_STRATEGY_PREFIX, combineWikiStrategyField } from './bosstiary-wiki-sync';
import { parseInfoboxParams, parseWikiBoss } from './bosstiary-wiki-parse';

describe('bosstiary wiki parse', () => {
  it('validates page title against expected boss name', () => {
    expect(validateWikiPageTitle('Abyssador', 'Abyssador')).toBe(true);
    expect(validateWikiPageTitle('Timira the Many', 'Timira the Many-Headed')).toBe(true);
    expect(validateWikiPageTitle('Abyssador', 'Rat')).toBe(false);
  });

  it('keeps loot separate from combat strategy in parsed output', () => {
    const wikitext = `{{Infobox Creature
|name = Demo Boss
|loot = {{Loot Item|Demon Shield||rare}}
|strategy = Mantenha distância.
}}`;
    const params = parseInfoboxParams(wikitext);
    expect(params.get('loot')).toContain('Demon Shield');
    const parsed = parseWikiBoss(wikitext, 'Demo Boss', 'test');
    expect(parsed.strategy).toBe(
      combineWikiStrategyField(
        `${BOSSTIARY_LOOT_STRATEGY_PREFIX} Demon Shield`,
        'Mantenha distância.',
      ),
    );
  });

  it('does not infer recommended levels from hp', () => {
    const wikitext = `{{Infobox Creature
|name = Tank
|hp = 250000
}}`;
    const parsed = parseWikiBoss(wikitext, 'Tank', 'test');
    expect(parsed.recommendedLevelSolo).toBeNull();
    expect(parsed.recommendedLevelParty).toBeNull();
    expect(parsed.difficulty).toBeNull();
  });
});
