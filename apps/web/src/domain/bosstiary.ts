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

export type BosstiaryDifficulty = "EASY" | "MEDIUM" | "HARD" | "VERY_HARD";
export type BosstiaryDifficultyFilter = "all" | BosstiaryDifficulty;
export type BosstiaryCategoryFilter = "all" | string;
export type BosstiaryAccessStatus = "UNKNOWN" | "NONE" | "REQUIRED";
export type BosstiaryFactKind = "official" | "editorial" | "estimated" | "pending";

export type BosstiaryEntry = {
  name: string;
  slug: string;
  sourceUrl: string;
  isboss: string;
  source: "tibiawiki-candidate" | "reviewed-profile";
  party: BossParty | null;
  recommendedLevel: BossLevel | null;
  recommendedLevelSolo: BossLevel | null;
  recommendedLevelParty: BossLevel | null;
  imageUrl: string | null;
  rewards: BosstiaryReward[];
  location: string | null;
  locationRegion: string | null;
  originCity: string | null;
  bossPoints: number | null;
  officialCategory: string | null;
  difficulty: BosstiaryDifficulty | null;
  accessStatus: BosstiaryAccessStatus | null;
  accessRequirements: string | null;
  howToReach: string | null;
  cooldownSeconds: number | null;
  estimatedCombatMinutes: number | null;
  mechanics: string | null;
  strategy: string | null;
};

export type BosstiaryReviewedProfile = {
  slug: string;
  officialCategory: string | null;
  huntMode: "SOLO" | "PARTY" | null;
  recommendedLevelSolo: number | null;
  recommendedLevelParty: number | null;
  difficulty: string | null;
  locationName: string | null;
  locationRegion: string | null;
  originCity: string | null;
  accessStatus: BosstiaryAccessStatus | null;
  accessRequirements: string | null;
  howToReach: string | null;
  cooldownSeconds: number | null;
  estimatedCombatMinutes: number | null;
  bossPoints: number | null;
  mechanics: string | null;
  strategy: string | null;
};

export type BosstiaryFilters = {
  query: string;
  party: BossPartyFilter;
  level: BossLevelFilter;
  difficulty?: BosstiaryDifficultyFilter;
  officialCategory?: BosstiaryCategoryFilter;
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
  const difficulty = filters.difficulty ?? "all";
  const officialCategory = filters.officialCategory ?? "all";
  return entries.filter((entry) => {
    if (query && !entry.name.toLocaleLowerCase("pt-BR").includes(query)) return false;
    if (filters.party !== "all" && entry.party !== filters.party) return false;
    if (filters.level !== "all" && entry.recommendedLevel !== filters.level) return false;
    if (difficulty !== "all" && entry.difficulty !== difficulty) return false;
    if (officialCategory !== "all" && entry.officialCategory !== officialCategory) return false;
    return true;
  });
}

export function bossesForLevelBand(
  entries: BosstiaryEntry[],
  party: Exclude<BossParty, "event">,
  level: BossLevel,
) {
  return entries
    .filter((entry) => entry.party === party && entry.recommendedLevel === level)
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

export function isBosstiaryDifficulty(value: string | null | undefined): value is BosstiaryDifficulty {
  return value === "EASY" || value === "MEDIUM" || value === "HARD" || value === "VERY_HARD";
}

export function mergeBosstiaryProfile(
  entry: BosstiaryEntry,
  profile: BosstiaryReviewedProfile | null,
): BosstiaryEntry {
  if (!profile) return entry;
  const partyFromProfile =
    profile.huntMode === "SOLO" ? "solo" : profile.huntMode === "PARTY" ? "party" : null;
  const soloLevel = isBossLevel(Number(profile.recommendedLevelSolo))
    ? (profile.recommendedLevelSolo as BossLevel)
    : entry.recommendedLevelSolo;
  const partyLevel = isBossLevel(Number(profile.recommendedLevelParty))
    ? (profile.recommendedLevelParty as BossLevel)
    : entry.recommendedLevelParty;
  const party = entry.party ?? partyFromProfile;
  const recommendedLevel =
    entry.recommendedLevel ??
    (party === "party" ? partyLevel : party === "solo" ? soloLevel : soloLevel ?? partyLevel) ??
    null;
  return {
    ...entry,
    source: "reviewed-profile",
    party,
    recommendedLevel,
    recommendedLevelSolo: soloLevel ?? entry.recommendedLevelSolo,
    recommendedLevelParty: partyLevel ?? entry.recommendedLevelParty,
    officialCategory: profile.officialCategory ?? entry.officialCategory,
    difficulty: isBosstiaryDifficulty(profile.difficulty) ? profile.difficulty : entry.difficulty,
    location: profile.locationName ?? entry.location,
    locationRegion: profile.locationRegion ?? entry.locationRegion,
    originCity: profile.originCity ?? entry.originCity,
    accessStatus: profile.accessStatus ?? entry.accessStatus,
    accessRequirements: profile.accessRequirements ?? entry.accessRequirements,
    howToReach: profile.howToReach ?? entry.howToReach,
    cooldownSeconds: profile.cooldownSeconds ?? entry.cooldownSeconds,
    estimatedCombatMinutes: profile.estimatedCombatMinutes ?? entry.estimatedCombatMinutes,
    bossPoints: profile.bossPoints ?? entry.bossPoints,
    mechanics: profile.mechanics ?? entry.mechanics,
    strategy: profile.strategy ?? entry.strategy,
  };
}

export function factKind(value: unknown, whenPresent: Exclude<BosstiaryFactKind, "pending">): BosstiaryFactKind {
  return value == null || value === "" ? "pending" : whenPresent;
}

export function factKindLabel(kind: BosstiaryFactKind) {
  if (kind === "official") return "Oficial";
  if (kind === "editorial") return "Editorial";
  if (kind === "estimated") return "Estimado";
  return "Pendente";
}

export function formatCooldown(seconds: number | null) {
  if (seconds == null) return null;
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return `${hours} ${hours === 1 ? "hora" : "horas"}`;
  }
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  }
  return `${seconds} segundos`;
}

export function formatMinutes(value: number | null | undefined) {
  if (value == null) return null;
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value < 1) return "< 1 min";
  if (Math.abs(value - Math.round(value)) < 0.05) return `${Math.round(value)} min`;
  return `${value.toFixed(1).replace(".", ",")} min`;
}

export function difficultyLabel(value: BosstiaryDifficulty | null) {
  if (value === "EASY") return "Fácil";
  if (value === "MEDIUM") return "Média";
  if (value === "HARD") return "Difícil";
  if (value === "VERY_HARD") return "Muito difícil";
  return null;
}

export function accessLabel(value: BosstiaryAccessStatus | null) {
  if (value === "NONE") return "Sem requisito de acesso conhecido";
  if (value === "REQUIRED") return "Acesso necessário";
  return null;
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
