import type {
  BosstiaryAccessStatus,
  BosstiaryHuntMode,
  Difficulty,
} from '../../generated/prisma/client.js';

export const BOSSTIARY_LOOT_STRATEGY_PREFIX = 'Drops principais:';
export const BOSSTIARY_COMBAT_STRATEGY_MARKER = '\n\n## Estratégia\n';

export type BosstiaryWikiParsed = {
  officialCategory: string | null;
  bossPoints: number | null;
  locationName: string | null;
  originCity: string | null;
  accessRequirements: string | null;
  accessStatus: BosstiaryAccessStatus | null;
  cooldownSeconds: number | null;
  strategy: string | null;
  mechanics: string | null;
  recommendedLevelSolo: number | null;
  recommendedLevelParty: number | null;
  difficulty: Difficulty | null;
  huntMode: BosstiaryHuntMode | null;
};

export type BosstiaryWikiPersisted = BosstiaryWikiParsed;

export function combineWikiStrategyField(loot: string | null, combatStrategy: string | null): string | null {
  if (loot && combatStrategy) {
    return `${loot}${BOSSTIARY_COMBAT_STRATEGY_MARKER}${combatStrategy}`;
  }
  return loot ?? combatStrategy ?? null;
}

function coalesceString(parsed: string | null | undefined, existing: string | null | undefined) {
  const next = parsed?.trim();
  if (next) return next;
  const current = existing?.trim();
  return current || null;
}

function coalesceNumber(parsed: number | null | undefined, existing: number | null | undefined) {
  if (parsed != null && Number.isFinite(parsed)) return parsed;
  if (existing != null && Number.isFinite(existing)) return existing;
  return null;
}

function coalesceEnum<T>(parsed: T | null | undefined, existing: T | null | undefined) {
  return parsed ?? existing ?? null;
}

/** Merge wiki parse into an existing row without clobbering manual review data. */
export function mergeWikiParsedIntoExisting(
  existing: BosstiaryWikiPersisted | null,
  parsed: BosstiaryWikiParsed,
): BosstiaryWikiPersisted {
  const base = existing ?? {
    officialCategory: null,
    bossPoints: null,
    locationName: null,
    originCity: null,
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
  return {
    officialCategory: coalesceString(parsed.officialCategory, base.officialCategory),
    bossPoints: coalesceNumber(parsed.bossPoints, base.bossPoints),
    locationName: coalesceString(parsed.locationName, base.locationName),
    originCity: coalesceString(parsed.originCity, base.originCity),
    accessRequirements: coalesceString(parsed.accessRequirements, base.accessRequirements),
    accessStatus: coalesceEnum(parsed.accessStatus, base.accessStatus),
    cooldownSeconds: coalesceNumber(parsed.cooldownSeconds, base.cooldownSeconds),
    strategy: coalesceString(parsed.strategy, base.strategy),
    mechanics: coalesceString(parsed.mechanics, base.mechanics),
    recommendedLevelSolo: coalesceNumber(parsed.recommendedLevelSolo, base.recommendedLevelSolo),
    recommendedLevelParty: coalesceNumber(parsed.recommendedLevelParty, base.recommendedLevelParty),
    difficulty: coalesceEnum(parsed.difficulty, base.difficulty),
    huntMode: coalesceEnum(parsed.huntMode, base.huntMode),
  };
}
