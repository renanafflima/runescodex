import { apiRequest, withQuery } from "./client";
import { readPage, type PageResult } from "./page";

export type BosstiaryActivityKind = "BOSS_KILL" | "DROP";
export type BosstiaryVisibility = "PRIVATE" | "PUBLIC" | "GROUP";

export type BosstiaryProgressSummary = {
  bossesDefeated: number;
  dropsRegistered: number;
  activitiesRegistered: number;
  bossesTracked: number;
  bossesCataloged: number;
};

export type BosstiaryProgressActivity = {
  id: string;
  kind: BosstiaryActivityKind;
  bossId: string | null;
  bossName: string;
  bossSlug: string | null;
  officialCategory: string | null;
  rotationId: string | null;
  rotationTitle: string | null;
  partyId: string | null;
  huntSessionId: string | null;
  itemName: string | null;
  itemQuantity: number | null;
  note: string | null;
  visibility: BosstiaryVisibility;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
};

export type BosstiaryChecklistItem = {
  bossId: string;
  slug: string;
  name: string;
  officialCategory: string | null;
  defeated: boolean;
  lastDefeatedAt: string | null;
  image: string | null;
};

export type BosstiaryProgressRotationOption = {
  id: string;
  title: string;
  status: string;
};

export function getBosstiaryProgressSummary() {
  return apiRequest<BosstiaryProgressSummary>("/bosstiary/progress/summary");
}

export function listBosstiaryProgressRotations() {
  return apiRequest<BosstiaryProgressRotationOption[]>("/bosstiary/progress/rotations");
}

export async function listBosstiaryProgressActivities(query: {
  kind?: BosstiaryActivityKind;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
} = {}) {
  const body = await apiRequest(
    withQuery("/bosstiary/progress/activities", query),
  );
  return readPage(body) as PageResult<BosstiaryProgressActivity>;
}

export function createBosstiaryProgressActivity(payload: {
  kind: BosstiaryActivityKind;
  bossId?: string;
  slug?: string;
  bossName?: string;
  rotationId?: string;
  partyId?: string;
  huntSessionId?: string;
  itemName?: string;
  itemQuantity?: number;
  note?: string;
  visibility?: BosstiaryVisibility;
  occurredAt: string;
}) {
  return apiRequest<BosstiaryProgressActivity>("/bosstiary/progress/activities", {
    method: "POST",
    json: payload,
  });
}

export function updateBosstiaryProgressActivity(
  id: string,
  payload: Partial<{
    bossId: string;
    bossName: string;
    rotationId: string | null;
    itemName: string;
    itemQuantity: number;
    note: string | null;
    visibility: BosstiaryVisibility;
    occurredAt: string;
  }>,
) {
  return apiRequest<BosstiaryProgressActivity>(`/bosstiary/progress/activities/${id}`, {
    method: "PATCH",
    json: payload,
  });
}

export function deleteBosstiaryProgressActivity(id: string) {
  return apiRequest<{ id: string; removed: boolean }>(`/bosstiary/progress/activities/${id}`, {
    method: "DELETE",
  });
}

export async function listBosstiaryProgressChecklist(query: {
  search?: string;
  filter?: "ALL" | "DONE" | "PENDING";
  page?: number;
  limit?: number;
} = {}) {
  const body = await apiRequest(withQuery("/bosstiary/progress/checklist", query));
  return readPage(body) as PageResult<BosstiaryChecklistItem>;
}

export function updateBosstiaryProgressChecklist(bossId: string, defeated: boolean) {
  return apiRequest<BosstiaryChecklistItem>(`/bosstiary/progress/checklist/${bossId}`, {
    method: "PATCH",
    json: { defeated },
  });
}
