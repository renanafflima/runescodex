import type { BestiaryCompanion, BestiaryEntry, BestiaryProgress, HuntListItem } from "../services/api/types";
import { formatCount, formatDifficultyLabel, hasNumericValue } from "./format";
import { resolveCreatureImage } from "./creature-image";
import { publicLinkUrl } from "./media";

export const BESTIARY_DIFFICULTIES = ["All", "Easy", "Medium", "Hard", "Very Hard"] as const;
export type BestiaryDifficultyFilter = (typeof BESTIARY_DIFFICULTIES)[number];
export const BESTIARY_HUNT_SORTS = ["level", "time", "name"] as const;
export type BestiaryHuntSort = (typeof BESTIARY_HUNT_SORTS)[number];

const DIFFICULTY_LABEL: Record<string, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
  VERY_HARD: "Very Hard",
};

const DIFFICULTY_VALUE: Record<string, string> = {
  Easy: "EASY",
  Medium: "MEDIUM",
  Hard: "HARD",
  "Very Hard": "VERY_HARD",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function mapProgress(value: unknown): BestiaryProgress | null {
  if (!value || typeof value !== "object") return null;
  const data = asRecord(value);
  return {
    kills: hasNumericValue(data.kills) ? Number(data.kills) : 0,
    completed: Boolean(data.completed),
    completedAt: typeof data.completedAt === "string" ? data.completedAt : null,
    progressPercentage: hasNumericValue(data.progressPercentage)
      ? Number(data.progressPercentage)
      : 0,
  };
}

export function mapBestiaryEntry(entry: unknown): BestiaryEntry {
  const data = asRecord(entry);
  const locations = Array.isArray(data.locations) ? data.locations : [];
  const location = locations[0] ? asRecord(locations[0]) : {};
  const killsPerHour = hasNumericValue(data.estimatedKillsPerHour)
    ? Number(data.estimatedKillsPerHour)
    : null;
  const killsRequired = hasNumericValue(data.killsRequired) ? Number(data.killsRequired) : null;
  const estimatedHours =
    hasNumericValue(data.estimatedHours)
      ? Number(data.estimatedHours)
      : killsPerHour && killsPerHour > 0 && killsRequired != null
        ? Math.ceil(killsRequired / killsPerHour)
        : null;
  const companions = mapCompanions(data.together);

  return {
    id: String(data.id || data.slug || data.name || ""),
    name: String(data.name || ""),
    slug: String(data.slug || ""),
    image: resolveCreatureImage(data.image, data.name),
    hp: hasNumericValue(data.hp) ? Number(data.hp) : null,
    experience: hasNumericValue(data.experience) ? Number(data.experience) : null,
    difficulty: DIFFICULTY_LABEL[String(data.difficulty || "")] || formatDifficultyLabel(data.difficulty),
    location: typeof location.name === "string" ? location.name : "",
    region: typeof location.region === "string" ? location.region : "",
    killsRequired,
    killsPerHour,
    estimatedHours,
    charmPoints: hasNumericValue(data.charmPoints) ? Number(data.charmPoints) : null,
    youtubeUrl: publicLinkUrl(data.youtubeUrl),
    companions,
    killTogether: companions.map((item) => item.name),
    weaknesses: (Array.isArray(data.elements) ? data.elements : [])
      .map((item) => (typeof item === "string" ? item : asRecord(item).element))
      .filter((item): item is string => Boolean(item)),
    description: typeof data.description === "string" ? data.description : null,
    progress: mapProgress(data.progress),
  };
}

function mapCompanions(value: unknown): BestiaryCompanion[] {
  return (Array.isArray(value) ? value : [])
    .map((item) => {
      const related = asRecord(item);
      const name = typeof related.name === "string" ? related.name : "";
      if (!name) return null;
      return {
        id: String(related.id || related.slug || name),
        name,
        slug: typeof related.slug === "string" ? related.slug : "",
        image: resolveCreatureImage(related.image, related.name),
      };
    })
    .filter((item): item is BestiaryCompanion => Boolean(item));
}

export function bestiaryApiDifficulty(filter: BestiaryDifficultyFilter) {
  if (filter === "All") return undefined;
  return DIFFICULTY_VALUE[filter];
}

export function filterBestiary(entries: BestiaryEntry[], query: string, difficulty: BestiaryDifficultyFilter) {
  const search = query.trim().toLowerCase();
  return entries.filter((entry) => {
    const matchDifficulty = difficulty === "All" || entry.difficulty === difficulty;
    const matchQuery =
      !search ||
      entry.name.toLowerCase().includes(search) ||
      entry.location.toLowerCase().includes(search) ||
      entry.region.toLowerCase().includes(search) ||
      entry.killTogether.some((name) => name.toLowerCase().includes(search));
    return matchDifficulty && matchQuery;
  });
}

export function formatBestiaryKills(entry: BestiaryEntry) {
  const required = formatCount(entry.killsRequired);
  if (!required) return null;
  if (!entry.progress) return required;
  return `${formatCount(entry.progress.kills)} / ${required}`;
}

export function formatEstimatedHours(hours: number | null | undefined) {
  if (!hasNumericValue(hours) || Number(hours) <= 0) return null;
  return `≈ ${Math.round(Number(hours))}h`;
}

export function companionSlugSet(entry: BestiaryEntry) {
  return new Set(
    entry.companions
      .map((item) => item.slug)
      .filter((slug): slug is string => Boolean(slug)),
  );
}

export function uniqueHuntCreatures(hunts: HuntListItem[]) {
  const seen = new Map<string, HuntListItem["spawn"][number]>();
  for (const hunt of hunts) {
    for (const creature of hunt.spawn) {
      const key = creature.slug || creature.name;
      if (!key || seen.has(key)) continue;
      seen.set(key, creature);
    }
  }
  return [...seen.values()];
}

function huntLevel(hunt: HuntListItem) {
  return hasNumericValue(hunt.levelMin) ? Number(hunt.levelMin) : Number.POSITIVE_INFINITY;
}

export function sortBestiaryHunts(hunts: HuntListItem[], sort: BestiaryHuntSort) {
  return [...hunts].sort((left, right) => {
    if (sort === "name") {
      return left.name.localeCompare(right.name, "pt-BR");
    }
    const byLevel = huntLevel(left) - huntLevel(right);
    if (byLevel) return byLevel;
    return left.name.localeCompare(right.name, "pt-BR");
  });
}

export function recommendedEvolutionHunts(hunts: HuntListItem[], creatureSlug: string) {
  const primary = hunts.filter((hunt) =>
    hunt.spawn.some((creature) => creature.slug === creatureSlug && creature.isPrimary),
  );
  return sortBestiaryHunts(primary.length ? primary : hunts, "level");
}
