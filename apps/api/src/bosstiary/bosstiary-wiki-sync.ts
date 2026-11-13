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
  locationRegion: string | null;
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
  howToReach?: string | null;
};

export type BosstiaryWikiPersisted = BosstiaryWikiParsed;

const WIKI_TRACKED_FIELDS = [
  'officialCategory',
  'bossPoints',
  'locationName',
  'locationRegion',
  'originCity',
  'howToReach',
  'accessRequirements',
  'accessStatus',
  'cooldownSeconds',
  'strategy',
  'mechanics',
  'recommendedLevelSolo',
  'recommendedLevelParty',
  'difficulty',
  'huntMode',
] as const satisfies readonly (keyof BosstiaryWikiParsed)[];

export type WikiFieldKey = (typeof WIKI_TRACKED_FIELDS)[number];

export function combineWikiStrategyField(loot: string | null, combatStrategy: string | null): string | null {
  if (loot && combatStrategy) {
    return `${loot}${BOSSTIARY_COMBAT_STRATEGY_MARKER}${combatStrategy}`;
  }
  return loot ?? combatStrategy ?? null;
}

/** Converts legacy mixed prose into loot + combat marker format for UI helpers. */
export function normalizeLegacyStrategyField(strategy: string | null | undefined): string | null {
  const raw = strategy?.trim();
  if (!raw) return null;
  if (raw.includes(BOSSTIARY_COMBAT_STRATEGY_MARKER)) return raw;
  if (raw.startsWith(BOSSTIARY_LOOT_STRATEGY_PREFIX) && !raw.includes('Drops principais:', 20)) {
    return raw;
  }

  const marker = /Drops principais:\s*/i.exec(raw);
  if (!marker || marker.index == null) {
    return raw.startsWith(BOSSTIARY_LOOT_STRATEGY_PREFIX) ? raw : raw;
  }

  const lootStart = marker.index;
  const lootBody = raw.slice(lootStart).trim();
  const lootItems = lootBody.replace(/^Drops principais:\s*/i, '').replace(/\.\s*$/, '').trim();
  const combatBefore = raw.slice(0, lootStart).trim();
  const combatAfter = raw.slice(lootStart + lootBody.length).trim();
  const combat = [combatBefore, combatAfter].filter(Boolean).join(' ').trim() || null;
  if (!lootItems) return combat ?? raw;
  return combineWikiStrategyField(`${BOSSTIARY_LOOT_STRATEGY_PREFIX} ${lootItems}`, combat);
}

function coalesceEnrichString(parsed: string | null | undefined, existing: string | null | undefined) {
  const current = existing?.trim();
  const next = parsed?.trim();
  if (current) return current;
  return next || null;
}

function coalesceNumber(parsed: number | null | undefined, existing: number | null | undefined) {
  if (existing != null && Number.isFinite(existing)) return existing;
  if (parsed != null && Number.isFinite(parsed)) return parsed;
  return null;
}

function coalesceEnum<T>(parsed: T | null | undefined, existing: T | null | undefined) {
  if (existing != null) return existing;
  return parsed ?? null;
}

function mergeAccess(
  existing: BosstiaryWikiPersisted,
  parsed: BosstiaryWikiParsed,
): Pick<BosstiaryWikiParsed, 'accessStatus' | 'accessRequirements'> {
  const manualAccess = existing.accessRequirements?.trim() || existing.howToReach?.trim();
  if (manualAccess) {
    return {
      accessRequirements: existing.accessRequirements,
      accessStatus: existing.accessStatus,
    };
  }
  if (!parsed.accessRequirements?.trim() && parsed.accessStatus === 'NONE') {
    return {
      accessRequirements: existing.accessRequirements,
      accessStatus: existing.accessStatus ?? parsed.accessStatus,
    };
  }
  return {
    accessRequirements: coalesceEnrichString(parsed.accessRequirements, existing.accessRequirements),
    accessStatus: coalesceEnum(parsed.accessStatus, existing.accessStatus),
  };
}

/** Merge wiki parse into an existing row without clobbering manual review data. */
export function mergeWikiParsedIntoExisting(
  existing: BosstiaryWikiPersisted | null,
  parsed: BosstiaryWikiParsed,
): BosstiaryWikiPersisted {
  const base: BosstiaryWikiPersisted = existing ?? {
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
  const access = mergeAccess(base, parsed);
  return {
    officialCategory: coalesceEnrichString(parsed.officialCategory, base.officialCategory),
    bossPoints: coalesceNumber(parsed.bossPoints, base.bossPoints),
    locationName: coalesceEnrichString(parsed.locationName, base.locationName),
    locationRegion: coalesceEnrichString(parsed.locationRegion, base.locationRegion),
    originCity: coalesceEnrichString(parsed.originCity, base.originCity),
    howToReach: coalesceEnrichString(parsed.howToReach ?? null, base.howToReach ?? null),
    accessRequirements: access.accessRequirements,
    accessStatus: access.accessStatus,
    cooldownSeconds: coalesceNumber(parsed.cooldownSeconds, base.cooldownSeconds),
    strategy: coalesceEnrichString(parsed.strategy, base.strategy),
    mechanics: coalesceEnrichString(parsed.mechanics, base.mechanics),
    recommendedLevelSolo: coalesceNumber(parsed.recommendedLevelSolo, base.recommendedLevelSolo),
    recommendedLevelParty: coalesceNumber(parsed.recommendedLevelParty, base.recommendedLevelParty),
    difficulty: coalesceEnum(parsed.difficulty, base.difficulty),
    huntMode: coalesceEnum(parsed.huntMode, base.huntMode),
  };
}

export function diffWikiPersisted(
  before: BosstiaryWikiPersisted | null,
  after: BosstiaryWikiPersisted,
): Partial<Record<WikiFieldKey, { before: unknown; after: unknown }>> {
  const diff: Partial<Record<WikiFieldKey, { before: unknown; after: unknown }>> = {};
  for (const key of WIKI_TRACKED_FIELDS) {
    const prev = before?.[key] ?? null;
    const next = after[key] ?? null;
    if (prev !== next) {
      diff[key] = { before: prev, after: next };
    }
  }
  return diff;
}
