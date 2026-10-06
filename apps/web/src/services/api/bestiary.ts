import { apiRequest, withQuery } from "./client";
import { loadEntireCatalog } from "./page";

export type BestiaryListQuery = {
  difficulty?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export function listBestiary(query: BestiaryListQuery = {}, withAuth = true) {
  return apiRequest(
    withQuery("/bestiary", {
      difficulty: query.difficulty,
      search: query.search,
      page: query.page,
      limit: query.limit,
    }),
    { auth: withAuth },
  );
}

export function listFilteredBestiary(query: BestiaryListQuery = {}, withAuth = true) {
  return loadEntireCatalog((pageQuery) =>
    listBestiary({ ...query, ...(pageQuery || {}) }, withAuth),
  );
}

export function getBestiaryBySlug(slug: string, withAuth = true) {
  return apiRequest(`/bestiary/${encodeURIComponent(slug)}`, { auth: withAuth });
}

export function updateBestiaryProgress(slug: string, kills: number) {
  return apiRequest(`/bestiary/${encodeURIComponent(slug)}/progress`, {
    method: "PATCH",
    json: { kills },
  });
}
