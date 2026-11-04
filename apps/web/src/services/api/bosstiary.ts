import type { BosstiaryRotationQuery, BosstiaryRotationResult } from "../../domain/bosstiary-rotations";
import { apiRequest, withQuery } from "./client";
import { CATALOG_PAGE_SIZE, readPage, type PageResult } from "./page";

export type BosstiaryHuntMode = "SOLO" | "PARTY";

export type BosstiaryReviewedBoss = {
  id: string;
  slug: string;
  name: string;
  source: "reviewed-profile";
  officialCategory: string | null;
  huntMode: BosstiaryHuntMode | null;
  recommendedLevelSolo: number | null;
  recommendedLevelParty: number | null;
  difficulty: string | null;
  locationName: string | null;
  locationRegion: string | null;
  originCity: string | null;
  accessStatus: "UNKNOWN" | "NONE" | "REQUIRED";
  accessRequirements: string | null;
  howToReach: string | null;
  cooldownSeconds: number | null;
  estimatedCombatMinutes: number | null;
  bossPoints: number | null;
  mechanics: string | null;
  strategy: string | null;
  vocations: string[];
};

export function listBosstiaryProfiles(query: {
  search?: string;
  huntMode?: BosstiaryHuntMode;
  recommendedLevel?: number;
  difficulty?: string;
  officialCategory?: string;
  page?: number;
  limit?: number;
} = {}) {
  return apiRequest(
    withQuery("/bosstiary/bosses", {
      search: query.search,
      huntMode: query.huntMode,
      recommendedLevel: query.recommendedLevel,
      difficulty: query.difficulty,
      officialCategory: query.officialCategory,
      page: query.page,
      limit: query.limit ?? CATALOG_PAGE_SIZE,
    }),
    { auth: true },
  );
}

export async function listBosstiaryProfilesPage(
  query: Parameters<typeof listBosstiaryProfiles>[0] = {},
): Promise<PageResult<BosstiaryReviewedBoss>> {
  return readPage(await listBosstiaryProfiles(query)) as PageResult<BosstiaryReviewedBoss>;
}

export function getBosstiaryProfile(slug: string) {
  return apiRequest<BosstiaryReviewedBoss>(`/bosstiary/bosses/${encodeURIComponent(slug)}`, {
    auth: true,
  });
}

export function findBosstiaryRotations(query: BosstiaryRotationQuery) {
  return apiRequest<BosstiaryRotationResult>(
    withQuery("/bosstiary/rotations", {
      availableMinutes: query.availableMinutes,
      level: query.level,
      huntMode: query.huntMode,
      vocation: query.vocation,
      originCity: query.originCity,
    }),
    { auth: true },
  );
}
