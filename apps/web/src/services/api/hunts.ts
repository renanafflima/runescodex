import { apiRequest, withQuery } from "./client";
import { CATALOG_PAGE_SIZE, readPage, type PageResult } from "./page";

export type HuntListQuery = {
  vocation?: string;
  difficulty?: string;
  location?: string;
  search?: string;
  creature?: string;
  level?: number;
  page?: number;
  limit?: number;
};

export function listHunts(query: HuntListQuery = {}) {
  return apiRequest(
    withQuery("/hunts", {
      vocation: query.vocation,
      difficulty: query.difficulty,
      location: query.location,
      search: query.search,
      creature: query.creature,
      level: query.level,
      page: query.page,
      limit: query.limit,
    }),
  );
}

export async function listHuntsPage(query: HuntListQuery = {}): Promise<PageResult<unknown>> {
  return readPage(
    await listHunts({
      limit: CATALOG_PAGE_SIZE,
      page: 1,
      ...query,
    }),
  );
}

export function getHuntBySlug(slug: string) {
  return apiRequest(`/hunts/${encodeURIComponent(slug)}`);
}
