import { apiRequest, withQuery } from "./client";
import { loadEntireCatalog } from "./page";

export type HuntListQuery = {
  vocation?: string;
  difficulty?: string;
  location?: string;
  search?: string;
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
      level: query.level,
      page: query.page,
      limit: query.limit,
    }),
    { auth: false },
  );
}

export function listFilteredHunts(query: HuntListQuery = {}) {
  return loadEntireCatalog((pageQuery) =>
    listHunts({ ...query, ...(pageQuery || {}) }),
  );
}

export function getHuntBySlug(slug: string) {
  return apiRequest(`/hunts/${encodeURIComponent(slug)}`, { auth: false });
}
