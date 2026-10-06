import type { HuntCreature, HuntDetail, HuntListItem, HuntLoot, HuntVideo, HuntVocation } from "../services/api/types";
import type { HuntListQuery } from "../services/api/hunts";
import type { Character } from "../services/api/types";
import {
  formatDifficultyLabel,
  formatHuntLocation,
  formatLevelRange,
  formatRate,
  hasNumericValue,
  toNumberOrNull,
} from "./format";
import { resolveCreatureImage } from "./creature-image";
import {
  uniqueElements,
  type CombatElement,
} from "./elements";
import { publicImageUrl, publicLinkUrl } from "./media";
import { normalizeVocation, type VocationCode } from "./vocation";

export const HUNT_VOCATION_FILTERS = ["Any", "EK", "RP", "ED", "MS", "EM"] as const;
export const HUNT_DIFFICULTIES = ["Any", "EASY", "MEDIUM", "HARD", "VERY_HARD"] as const;
export const HUNT_SORTS = ["Best XP", "Best Profit", "Level", "Name"] as const;

export type HuntVocationFilter = (typeof HUNT_VOCATION_FILTERS)[number];
export type HuntDifficultyFilter = (typeof HUNT_DIFFICULTIES)[number];
export type HuntSort = (typeof HUNT_SORTS)[number];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function elementTypes(elements: unknown) {
  return (Array.isArray(elements) ? elements : [])
    .map((item) => (typeof item === "string" ? item : asRecord(item).element))
    .filter((item): item is string => Boolean(item));
}

function mapVocations(vocations: unknown): HuntVocation[] {
  return (Array.isArray(vocations) ? vocations : []).map((item) => {
    const entry = asRecord(item);
    return {
      vocation: typeof entry.vocation === "string" ? entry.vocation : null,
      isRecommended: Boolean(entry.isRecommended),
      levelMin: hasNumericValue(entry.levelMin) ? Number(entry.levelMin) : null,
      levelMax: hasNumericValue(entry.levelMax) ? Number(entry.levelMax) : null,
      xpPerHour: hasNumericValue(entry.xpPerHour) ? Number(entry.xpPerHour) : null,
      profitPerHour: hasNumericValue(entry.profitPerHour) ? Number(entry.profitPerHour) : null,
      difficulty: typeof entry.difficulty === "string" ? entry.difficulty : null,
      notes: typeof entry.notes === "string" ? entry.notes : null,
    };
  });
}

export function pickHuntVocation(vocations: HuntVocation[], preferred?: string | null) {
  if (preferred && preferred !== "Any") {
    const match = vocations.find((item) => item.vocation === preferred);
    if (match) return match;
  }
  return vocations.find((item) => item.isRecommended) || vocations[0] || null;
}

function mapHuntCreature(item: unknown): HuntCreature {
  const entry = asRecord(item);
  const nested = entry.creature && typeof entry.creature === "object" ? asRecord(entry.creature) : null;
  const source = nested || entry;
  const name = String(source.name || entry.name || "");
  return {
    id: typeof source.id === "string" ? source.id : typeof entry.id === "string" ? entry.id : null,
    slug: typeof source.slug === "string" ? source.slug : typeof entry.slug === "string" ? entry.slug : null,
    name,
    image: resolveCreatureImage(source.image || entry.image, source.slug, source.name, entry.name),
    hp: nested ? (hasNumericValue(nested.hp) ? Number(nested.hp) : null) : hasNumericValue(entry.hp) ? Number(entry.hp) : null,
    xp: nested
      ? hasNumericValue(nested.experience)
        ? Number(nested.experience)
        : null
      : hasNumericValue(entry.experience)
        ? Number(entry.experience)
        : hasNumericValue(entry.xp)
          ? Number(entry.xp)
          : null,
    elements: elementTypes(nested?.elements || entry.elements),
    recommendedCharm: typeof entry.recommendedCharm === "string" ? entry.recommendedCharm : null,
    damageType: typeof entry.damageType === "string" ? entry.damageType : null,
    isPrimary: Boolean(entry.isPrimary),
    quantity: hasNumericValue(entry.quantity) ? Number(entry.quantity) : null,
    notes: typeof entry.notes === "string" ? entry.notes : null,
  };
}

function mapHuntVideos(videos: unknown): HuntVideo[] {
  return (Array.isArray(videos) ? videos : [])
    .map((item) => {
      const entry = asRecord(item);
      const url = publicLinkUrl(entry.url);
      if (!url) return null;
      return {
        id: String(entry.id || url),
        title: typeof entry.title === "string" ? entry.title : null,
        url,
        channel: typeof entry.channel === "string" ? entry.channel : null,
        isRecommended: Boolean(entry.isRecommended),
      };
    })
    .filter((item): item is HuntVideo => Boolean(item));
}

function mapHuntLoot(loot: unknown): HuntLoot[] {
  return (Array.isArray(loot) ? loot : [])
    .map((item) => {
      const entry = asRecord(item);
      if (typeof entry.itemName !== "string" || !entry.itemName) return null;
      return {
        id: String(entry.id || entry.itemName),
        itemName: entry.itemName,
        image: resolveCreatureImage(entry.itemImage, entry.image, entry.itemName),
        estimatedValue: hasNumericValue(entry.estimatedValue) ? Number(entry.estimatedValue) : null,
        importance: typeof entry.importance === "string" ? entry.importance : null,
      };
    })
    .filter((item): item is HuntLoot => Boolean(item));
}

function mapHuntBase(hunt: unknown, preferredVocation?: string | null): HuntListItem {
  const data = asRecord(hunt);
  const vocations = mapVocations(data.vocations);
  const vocation = pickHuntVocation(vocations, preferredVocation);
  const spawn = (Array.isArray(data.creatures) ? data.creatures : []).map(mapHuntCreature);
  const primary = spawn.find((item) => item.isPrimary) || spawn[0] || null;
  const videos = mapHuntVideos(data.videos);
  return {
    id: String(data.id || ""),
    slug: String(data.slug || ""),
    name: String(data.name || ""),
    location: typeof data.location === "string" ? data.location : null,
    subLocation: typeof data.subLocation === "string" ? data.subLocation : null,
    displayLocation: formatHuntLocation(data.location, data.subLocation),
    difficulty: typeof data.difficulty === "string" ? data.difficulty : null,
    respawn: typeof data.respawn === "string" ? data.respawn : null,
    vocations,
    creature: primary?.name || "",
    creatureImage: primary?.image || null,
    xpH: vocation?.xpPerHour ?? null,
    profitH: vocation?.profitPerHour ?? null,
    levelMin: vocation?.levelMin ?? null,
    levelMax: vocation?.levelMax ?? null,
    vocation: vocation?.vocation || null,
    spawn,
    mapImage: publicImageUrl(data.mapImage),
    youtubeUrl: videos.find((item) => item.isRecommended)?.url || videos[0]?.url || null,
  };
}

export function mapHuntListItem(hunt: unknown, preferredVocation?: string | null): HuntListItem {
  return mapHuntBase(hunt, preferredVocation);
}

export function mapHuntDetail(hunt: unknown, preferredVocation?: string | null): HuntDetail {
  const data = asRecord(hunt);
  const videos = mapHuntVideos(data.videos);
  return {
    ...mapHuntBase(hunt, preferredVocation),
    description: typeof data.description === "string" ? data.description : null,
    heroImage: publicImageUrl(data.heroImage),
    videos,
    youtubeUrl: videos.find((item) => item.isRecommended)?.url || videos[0]?.url || null,
    loot: mapHuntLoot(data.loot),
  };
}

function levelFits(entry: HuntVocation | null | undefined, level: unknown) {
  if (!entry || !hasNumericValue(level)) return false;
  const numericLevel = Number(level);
  if (entry.levelMin != null && numericLevel < Number(entry.levelMin)) return false;
  if (entry.levelMax != null && numericLevel > Number(entry.levelMax)) return false;
  return entry.levelMin != null || entry.levelMax != null;
}

export function huntCompatibility(hunt: HuntListItem | HuntDetail | null | undefined, character: Character | null | undefined) {
  if (!character || !hunt) return 0;
  const vocation = normalizeVocation(character.vocation);
  const vocations = Array.isArray(hunt.vocations) ? hunt.vocations : [];
  const vocationEntry = vocation
    ? vocations.find((entry) => normalizeVocation(entry.vocation) === vocation)
    : null;

  if (vocationEntry && levelFits(vocationEntry, character.level)) return 4;
  if (vocationEntry) return 2;
  if (vocations.some((entry) => levelFits(entry, character.level))) return 1;
  return 0;
}

export function preferredHuntVocation(
  vocationFilter: HuntVocationFilter,
  character: Character | null | undefined,
): VocationCode | null {
  if (vocationFilter !== "Any") return vocationFilter;
  return normalizeVocation(character?.vocation);
}

export function huntListQueryFromFilters(options: {
  vocation: HuntVocationFilter;
  difficulty: HuntDifficultyFilter;
  character: Character | null | undefined;
}): HuntListQuery {
  const query: HuntListQuery = {};
  if (options.vocation !== "Any") {
    query.vocation = options.vocation;
  }
  if (options.difficulty !== "Any") {
    query.difficulty = options.difficulty;
  }
  if (hasNumericValue(options.character?.level)) {
    query.level = Number(options.character?.level);
  }
  return query;
}

function includesQuery(value: unknown, query: string) {
  return String(value || "").toLocaleLowerCase().includes(query);
}

export type HuntClientFilters = {
  query: string;
  vocation: HuntVocationFilter;
  attackElement?: CombatElement | "Any";
  defenseElement?: CombatElement | "Any";
  minXpH: string;
  minProfitH: string;
  minLevel: string;
  sortBy: HuntSort;
  character: Character | null | undefined;
};

export function huntAttackElements(hunt: HuntListItem | HuntDetail) {
  return uniqueElements(
    hunt.spawn.flatMap((creature) => [
      ...creature.elements,
      creature.recommendedCharm,
    ]),
  );
}

export function huntDefenseElements(hunt: HuntListItem | HuntDetail) {
  return uniqueElements(hunt.spawn.map((creature) => creature.damageType));
}

export function primaryAttackElement(hunt: HuntListItem | HuntDetail) {
  return huntAttackElements(hunt)[0] || null;
}

export function primaryDefenseElement(hunt: HuntListItem | HuntDetail) {
  return huntDefenseElements(hunt)[0] || null;
}

export function filterAndSortHunts(hunts: HuntListItem[], filters: HuntClientFilters) {
  const search = filters.query.trim().toLocaleLowerCase();
  const xpN = toNumberOrNull(filters.minXpH);
  const profitN = toNumberOrNull(filters.minProfitH);
  const levelN = toNumberOrNull(filters.minLevel);

  const filtered = hunts.filter((hunt) => {
    const matchVocation =
      filters.vocation === "Any" ||
      hunt.vocations.some((entry) => entry.vocation === filters.vocation);
    const matchQuery =
      !search ||
      includesQuery(hunt.name, search) ||
      includesQuery(hunt.location, search) ||
      includesQuery(hunt.subLocation, search) ||
      includesQuery(hunt.displayLocation, search) ||
      includesQuery(hunt.creature, search) ||
      hunt.spawn.some((creature) => includesQuery(creature.name, search));
    const matchXp = xpN ? hasNumericValue(hunt.xpH) && Number(hunt.xpH) >= xpN : true;
    const matchProfit = profitN ? hasNumericValue(hunt.profitH) && Number(hunt.profitH) >= profitN : true;
    const matchLevel = levelN
      ? hunt.vocations.some((item) => {
          const min = item.levelMin;
          const max = item.levelMax;
          if (min == null && max == null) return false;
          if (min != null && levelN < Number(min)) return false;
          if (max != null && levelN > Number(max)) return false;
          return true;
        })
      : true;
    const matchAttack =
      !filters.attackElement ||
      filters.attackElement === "Any" ||
      huntAttackElements(hunt).includes(filters.attackElement);
    const matchDefense =
      !filters.defenseElement ||
      filters.defenseElement === "Any" ||
      huntDefenseElements(hunt).includes(filters.defenseElement);
    return matchVocation && matchQuery && matchXp && matchProfit && matchLevel && matchAttack && matchDefense;
  });

  return [...filtered].sort((a, b) => {
    const compatibilityDiff =
      huntCompatibility(b, filters.character) - huntCompatibility(a, filters.character);
    if (compatibilityDiff) return compatibilityDiff;
    if (filters.sortBy === "Best XP") {
      return (hasNumericValue(b.xpH) ? Number(b.xpH) : -1) - (hasNumericValue(a.xpH) ? Number(a.xpH) : -1);
    }
    if (filters.sortBy === "Best Profit") {
      return (hasNumericValue(b.profitH) ? Number(b.profitH) : -1) - (hasNumericValue(a.profitH) ? Number(a.profitH) : -1);
    }
    if (filters.sortBy === "Level") {
      const aLevel = hasNumericValue(a.levelMin) ? Number(a.levelMin) : Number.POSITIVE_INFINITY;
      const bLevel = hasNumericValue(b.levelMin) ? Number(b.levelMin) : Number.POSITIVE_INFINITY;
      return aLevel - bLevel;
    }
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

export function huntSummary(hunt: HuntListItem) {
  return {
    difficulty: formatDifficultyLabel(hunt.difficulty),
    level: formatLevelRange(hunt.levelMin, hunt.levelMax),
    xp: formatRate(hunt.xpH),
    profit: formatRate(hunt.profitH),
  };
}
