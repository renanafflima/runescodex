import { apiRequest, withQuery } from "./client";
import { readPage } from "./page";

export type CharmGuideCpCategory = "CP_100" | "CP_200" | "CP_300" | "CP_500";
export type CharmGuideDifficulty = "EASY" | "MEDIUM" | "ADVANCED" | "CHALLENGING";
export type CharmGuideStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "PUBLISHED"
  | "REJECTED"
  | "CHANGES_REQUESTED"
  | "ARCHIVED";

export type CharmGuideCard = {
  id: string;
  title: string;
  description: string;
  coverImage: string | null;
  cpCategory: CharmGuideCpCategory;
  difficulty: CharmGuideDifficulty;
  status: CharmGuideStatus;
  totalCharmPoints: number;
  uniqueCreatureCount: number;
  stepCount: number;
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  likedByMe: boolean;
  favoritedByMe: boolean;
  publishedAt: string | null;
  createdAt: string;
  author: { id: string; name: string };
};

export type CharmGuideCreature = {
  id: string;
  slug: string;
  name: string;
  image: string;
  difficulty: string | null;
  charmPoints: number | null;
  countsTowardTotal: boolean;
  repeatedFromEarlierStep: boolean;
  completed: boolean;
};

export type CharmGuideStep = {
  id: string;
  position: number;
  title: string | null;
  notes: string | null;
  hunt: { id: string; slug: string; name: string } | null;
  creatures: CharmGuideCreature[];
};

export type CharmGuideDetail = CharmGuideCard & {
  adminResponse: string | null;
  ticket: { id: string; protocol: string; status: string } | null;
  steps: CharmGuideStep[];
  progress: { completedCreatureIds: string[] };
};

export type CharmGuideCategorySummary = {
  categories: Array<{
    cpCategory: CharmGuideCpCategory;
    targetPoints: number;
    label: string;
    guideCount: number;
  }>;
};

export type CharmGuideStepInput = {
  huntId?: string;
  title?: string;
  notes?: string;
  creatureIds: string[];
};

export type CreateCharmGuideBody = {
  title: string;
  description: string;
  cpCategory: CharmGuideCpCategory;
  difficulty: CharmGuideDifficulty;
  coverImage?: string;
  steps: CharmGuideStepInput[];
};

export function getCharmGuideCategories() {
  return apiRequest<CharmGuideCategorySummary>("/charm-guides/categories/summary");
}

export function listCharmGuides(query: {
  cpCategory?: CharmGuideCpCategory | "";
  sort?: "RECENT" | "LIKED";
  page?: number;
  limit?: number;
}) {
  return apiRequest(
    withQuery("/charm-guides", {
      cpCategory: query.cpCategory || undefined,
      sort: query.sort,
      page: query.page,
      limit: query.limit,
    }),
  ).then((payload) => readPage<CharmGuideCard>(payload));
}

export function getCharmGuide(id: string, characterId?: string) {
  return apiRequest<CharmGuideDetail>(
    withQuery(`/charm-guides/${encodeURIComponent(id)}`, { characterId }),
  );
}

export function createCharmGuide(body: CreateCharmGuideBody) {
  return apiRequest<CharmGuideDetail>("/charm-guides", { method: "POST", json: body });
}

export function updateCharmGuide(id: string, body: Partial<CreateCharmGuideBody>) {
  return apiRequest<CharmGuideDetail>(`/charm-guides/${encodeURIComponent(id)}`, {
    method: "PATCH",
    json: body,
  });
}

export function submitCharmGuide(id: string, idempotencyKey?: string) {
  return apiRequest<CharmGuideDetail>(`/charm-guides/${encodeURIComponent(id)}/submit`, {
    method: "POST",
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });
}

export function likeCharmGuide(id: string) {
  return apiRequest<{ liked: boolean }>(`/charm-guides/${encodeURIComponent(id)}/like`, {
    method: "POST",
  });
}

export function unlikeCharmGuide(id: string) {
  return apiRequest<{ liked: boolean }>(`/charm-guides/${encodeURIComponent(id)}/like`, {
    method: "DELETE",
  });
}

export function favoriteCharmGuide(id: string) {
  return apiRequest<{ favorited: boolean }>(`/charm-guides/${encodeURIComponent(id)}/favorite`, {
    method: "POST",
  });
}

export function unfavoriteCharmGuide(id: string) {
  return apiRequest<{ favorited: boolean }>(`/charm-guides/${encodeURIComponent(id)}/favorite`, {
    method: "DELETE",
  });
}

export function updateCharmGuideProgress(
  id: string,
  body: { characterId: string; creatureId: string; completed: boolean },
) {
  return apiRequest(`/charm-guides/${encodeURIComponent(id)}/progress`, {
    method: "PATCH",
    json: body,
  });
}

export function listCharmGuideComments(id: string, page = 1) {
  return apiRequest(
    withQuery(`/charm-guides/${encodeURIComponent(id)}/comments`, { page, limit: 20 }),
  ).then((payload) => readPage(payload));
}

export function createCharmGuideComment(
  id: string,
  body: { content: string; parentId?: string },
) {
  return apiRequest(`/charm-guides/${encodeURIComponent(id)}/comments`, {
    method: "POST",
    json: body,
  });
}

export function listAdminCharmGuides(status?: CharmGuideStatus) {
  return apiRequest<CharmGuideCard[]>(
    withQuery("/admin/charm-guides", { status }),
  );
}

export function getAdminCharmGuide(id: string) {
  return apiRequest<CharmGuideDetail>(`/admin/charm-guides/${encodeURIComponent(id)}`);
}

export function moderateAdminCharmGuide(
  id: string,
  body: { status: "PUBLISHED" | "REJECTED" | "CHANGES_REQUESTED"; adminResponse?: string },
) {
  return apiRequest(`/admin/charm-guides/${encodeURIComponent(id)}`, {
    method: "PATCH",
    json: body,
  });
}
