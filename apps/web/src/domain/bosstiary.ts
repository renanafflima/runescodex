import { creatureImageKey } from "./creature-image";

export const BOSS_LEVELS = [300, 500, 700, 1000] as const;
export const BOSS_PARTIES = ["solo", "party", "event"] as const;

export type BossLevel = (typeof BOSS_LEVELS)[number];
export type BossParty = (typeof BOSS_PARTIES)[number];
export type BossPartyFilter = "all" | BossParty;
export type BossLevelFilter = "all" | BossLevel;

export type BosstiaryReward = {
  name: string;
  imageUrl: string | null;
};

export type BosstiaryEntry = {
  name: string;
  slug: string;
  sourceUrl: string;
  isboss: string;
  source: "tibiawiki-candidate";
  party: BossParty | null;
  recommendedLevel: BossLevel | null;
  imageUrl: string | null;
  rewards: BosstiaryReward[];
  location: string | null;
  bossPoints: number | null;
};

export type BosstiaryFilters = {
  query: string;
  party: BossPartyFilter;
  level: BossLevelFilter;
};

export type BossImageFile = {
  fileName: string;
  url: string;
};

const PARTY_LABELS: Record<BossParty, string> = {
  solo: "Boss Solo",
  party: "Boss PT",
  event: "Evento",
};

export function bossPartyLabel(party: BossParty | null) {
  return party ? PARTY_LABELS[party] : null;
}

export function isBossLevel(value: number): value is BossLevel {
  return BOSS_LEVELS.some((level) => level === value);
}

export function isBossParty(value: string): value is BossParty {
  return BOSS_PARTIES.some((party) => party === value);
}

export function indexBossImages(files: BossImageFile[]) {
  const images = new Map<string, string>();
  const ordered = [...files].sort((left, right) => {
    const leftDuplicate = /\(\d+\)/.test(left.fileName) ? 1 : 0;
    const rightDuplicate = /\(\d+\)/.test(right.fileName) ? 1 : 0;
    return leftDuplicate - rightDuplicate;
  });
  for (const file of ordered) {
    const key = creatureImageKey(file.fileName);
    if (!key || images.has(key)) continue;
    images.set(key, file.url);
  }
  return images;
}

export function bossImageUrl(
  name: string,
  slug: string,
  images: ReadonlyMap<string, string>,
) {
  return images.get(creatureImageKey(name)) ?? images.get(creatureImageKey(slug)) ?? null;
}

export function filterBosstiary(entries: BosstiaryEntry[], filters: BosstiaryFilters) {
  const query = filters.query.trim().toLocaleLowerCase("pt-BR");
  return entries.filter((entry) => {
    if (query && !entry.name.toLocaleLowerCase("pt-BR").includes(query)) return false;
    if (filters.party !== "all" && entry.party !== filters.party) return false;
    if (filters.level !== "all" && entry.recommendedLevel !== filters.level) return false;
    return true;
  });
}

export function applyBossReview<T extends { slug: string; party: BossParty | null; recommendedLevel: BossLevel | null }>(
  entries: T[],
  reviews: Array<{ slug: string; party: BossParty; recommendedLevel: BossLevel }>,
) {
  const reviewBySlug = new Map<string, { party: BossParty; recommendedLevel: BossLevel }>();
  for (const review of reviews) {
    if (!isBossParty(review.party) || !isBossLevel(review.recommendedLevel)) continue;
    if (reviewBySlug.has(review.slug)) continue;
    reviewBySlug.set(review.slug, review);
  }
  return entries.map((entry) => {
    const review = reviewBySlug.get(entry.slug);
    if (!review) return entry;
    return {
      ...entry,
      party: review.party,
      recommendedLevel: review.recommendedLevel,
    };
  });
}
