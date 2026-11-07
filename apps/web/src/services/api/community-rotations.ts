import { CATALOG_PAGE_SIZE, readPage, type PageResult } from "./page";
import { apiRequest, withQuery } from "./client";

const BASE = "/bosstiary/community/rotations";

export type CommunityRecommendedLevel = "L300" | "L500" | "L700" | "L1000_PLUS";
export type CommunityLevelFilter = "ALL" | "300" | "500" | "700" | "1000_PLUS";
export type CommunityModeFilter = "ALL" | "SOLO" | "PARTY";
export type CommunityDurationFilter = "ALL" | "15" | "30" | "60";
export type CommunityRotationSort = "LIKES" | "RECENT" | "COMMENTS";
export type CommunityHuntMode = "SOLO" | "PARTY";
export type CommunityRotationStatus = "DRAFT" | "PUBLISHED" | "HIDDEN" | "REMOVED";

export type CommunityRotationBossStop = {
  id: string;
  position: number;
  notes: string | null;
  bossId: string | null;
  bossName: string | null;
  slug: string | null;
  name: string | null;
  image: string | null;
};

export type CommunityRotationCard = {
  id: string;
  title: string;
  description: string | null;
  accessRequirements: string | null;
  additionalInfo: string | null;
  recommendedLevel: CommunityRecommendedLevel;
  recommendedLevelLabel: string;
  huntMode: CommunityHuntMode;
  plannedDurationMinutes: number;
  vocation: string | null;
  characterLevel: number | null;
  partySize: number | null;
  observedTotalMinutes: number | null;
  combatMinutes: number | null;
  travelMinutes: number | null;
  status: CommunityRotationStatus;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string | null };
  bosses: CommunityRotationBossStop[];
  likesCount: number;
  favoritesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  favoritedByMe: boolean;
  testedByAuthor: boolean;
  featured: boolean;
};

export type CommunityRotationRankingItem = CommunityRotationCard & {
  weeklyLikes: number;
};

export type CommunityRotationListResponse = PageResult<CommunityRotationCard> & {
  rankingPreview?: CommunityRotationRankingItem[];
  levelLabels?: Record<CommunityRecommendedLevel, string>;
};

export type CommunityRotationSocialState = {
  rotationId: string;
  likesCount: number;
  favoritesCount: number;
  likedByMe: boolean;
  favoritedByMe: boolean;
};

export type CommunityRotationBossInput = {
  bossId?: string;
  bossName?: string;
  position: number;
  notes?: string;
};

export type CreateCommunityRotationPayload = {
  title: string;
  description?: string;
  accessRequirements?: string;
  additionalInfo?: string;
  recommendedLevel: CommunityRecommendedLevel;
  huntMode: CommunityHuntMode;
  plannedDurationMinutes: 15 | 30 | 60;
  vocation?: string;
  characterLevel?: number;
  partySize?: number;
  observedTotalMinutes?: number;
  combatMinutes?: number;
  travelMinutes?: number;
  bosses: CommunityRotationBossInput[];
};

export type UpdateCommunityRotationPayload = Partial<CreateCommunityRotationPayload>;

export type CreateCommunityRotationTestPayload = {
  vocation?: string;
  characterLevel?: number;
  partySize?: number;
  combatMinutes?: number;
  travelMinutes?: number;
  totalMinutes?: number;
  notes?: string;
};

export type CommunityRotationTest = {
  id: string;
  rotationId: string;
  userId: string;
  vocation: string | null;
  characterLevel: number | null;
  partySize: number | null;
  combatMinutes: number | null;
  travelMinutes: number | null;
  totalMinutes: number | null;
  notes: string | null;
  createdAt: string;
};

export type CommunityRotationComment = {
  id: string;
  content: string;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string | null };
  likesCount: number;
  likedByMe: boolean;
  replies: CommunityRotationComment[];
};

export type CommunityRotationCommentPage = PageResult<CommunityRotationComment> & {
  commentCount: number;
};

export type ListCommunityRotationsQuery = {
  page?: number;
  limit?: number;
  level?: CommunityLevelFilter;
  mode?: CommunityModeFilter;
  duration?: CommunityDurationFilter;
  sort?: CommunityRotationSort;
  search?: string;
  rankingPreview?: number;
};

export async function listCommunityRotations(
  query: ListCommunityRotationsQuery = {},
): Promise<CommunityRotationListResponse> {
  const raw = await apiRequest(
    withQuery(BASE, {
      page: query.page,
      limit: query.limit ?? CATALOG_PAGE_SIZE,
      level: query.level && query.level !== "ALL" ? query.level : undefined,
      mode: query.mode && query.mode !== "ALL" ? query.mode : undefined,
      duration: query.duration && query.duration !== "ALL" ? query.duration : undefined,
      sort: query.sort,
      search: query.search,
      rankingPreview: query.rankingPreview,
    }),
    { auth: true },
  );
  const page = readPage<CommunityRotationCard>(raw);
  const extra = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    ...page,
    rankingPreview: Array.isArray(extra.rankingPreview)
      ? (extra.rankingPreview as CommunityRotationRankingItem[])
      : undefined,
    levelLabels:
      extra.levelLabels && typeof extra.levelLabels === "object"
        ? (extra.levelLabels as Record<CommunityRecommendedLevel, string>)
        : undefined,
  };
}

export function listCommunityRotationRanking(limit = 10) {
  return apiRequest<CommunityRotationRankingItem[]>(
    withQuery(`${BASE}/ranking`, { limit }),
    { auth: true },
  );
}

export function getCommunityRotation(id: string) {
  return apiRequest<CommunityRotationCard>(`${BASE}/${encodeURIComponent(id)}`, { auth: true });
}

export function createCommunityRotation(
  payload: CreateCommunityRotationPayload,
  options?: { idempotencyKey?: string },
) {
  return apiRequest<CommunityRotationCard>(BASE, {
    method: "POST",
    json: payload,
    auth: true,
    headers: options?.idempotencyKey
      ? { "Idempotency-Key": options.idempotencyKey }
      : undefined,
  });
}

export function updateCommunityRotation(id: string, payload: UpdateCommunityRotationPayload) {
  return apiRequest<CommunityRotationCard>(`${BASE}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    json: payload,
    auth: true,
  });
}

export function deleteCommunityRotation(id: string) {
  return apiRequest<{ id: string; removed: boolean }>(`${BASE}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    auth: true,
  });
}

export function likeCommunityRotation(id: string) {
  return apiRequest<CommunityRotationSocialState>(`${BASE}/${encodeURIComponent(id)}/like`, {
    method: "POST",
    auth: true,
  });
}

export function unlikeCommunityRotation(id: string) {
  return apiRequest<CommunityRotationSocialState>(`${BASE}/${encodeURIComponent(id)}/like`, {
    method: "DELETE",
    auth: true,
  });
}

export function favoriteCommunityRotation(id: string) {
  return apiRequest<CommunityRotationSocialState>(`${BASE}/${encodeURIComponent(id)}/favorite`, {
    method: "POST",
    auth: true,
  });
}

export function unfavoriteCommunityRotation(id: string) {
  return apiRequest<CommunityRotationSocialState>(`${BASE}/${encodeURIComponent(id)}/favorite`, {
    method: "DELETE",
    auth: true,
  });
}

export function listCommunityRotationComments(id: string, page = 1, limit = 20) {
  return apiRequest<CommunityRotationCommentPage>(
    withQuery(`${BASE}/${encodeURIComponent(id)}/comments`, { page, limit }),
    { auth: true },
  );
}

export function createCommunityRotationComment(id: string, content: string, parentId?: string) {
  return apiRequest<CommunityRotationComment>(`${BASE}/${encodeURIComponent(id)}/comments`, {
    method: "POST",
    json: parentId ? { content, parentId } : { content },
    auth: true,
  });
}

export function updateCommunityRotationComment(id: string, commentId: string, content: string) {
  return apiRequest<CommunityRotationComment>(
    `${BASE}/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}`,
    { method: "PATCH", json: { content }, auth: true },
  );
}

export function deleteCommunityRotationComment(id: string, commentId: string) {
  return apiRequest<CommunityRotationComment>(
    `${BASE}/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}`,
    { method: "DELETE", auth: true },
  );
}

export function likeCommunityRotationComment(id: string, commentId: string) {
  return apiRequest(
    `${BASE}/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}/like`,
    { method: "POST", auth: true },
  );
}

export function unlikeCommunityRotationComment(id: string, commentId: string) {
  return apiRequest(
    `${BASE}/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}/like`,
    { method: "DELETE", auth: true },
  );
}

export async function listCommunityRotationTests(id: string, page = 1, limit = 20) {
  return readPage<CommunityRotationTest>(
    await apiRequest(withQuery(`${BASE}/${encodeURIComponent(id)}/tests`, { page, limit }), {
      auth: true,
    }),
  );
}

export function createCommunityRotationTest(id: string, payload: CreateCommunityRotationTestPayload) {
  return apiRequest<CommunityRotationTest>(`${BASE}/${encodeURIComponent(id)}/tests`, {
    method: "POST",
    json: payload,
    auth: true,
  });
}
