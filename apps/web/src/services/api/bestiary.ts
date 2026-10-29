import { apiRequest, withQuery } from "./client";
import { CATALOG_PAGE_SIZE, readPage, type PageResult } from "./page";

export type BestiaryListQuery = {
  difficulty?: string;
  search?: string;
  vocation?: string;
  level?: number;
  page?: number;
  limit?: number;
};

export function listBestiary(query: BestiaryListQuery = {}, withAuth = true) {
  return apiRequest(
    withQuery("/bestiary", {
      difficulty: query.difficulty,
      search: query.search,
      vocation: query.vocation,
      level: query.level,
      page: query.page,
      limit: query.limit,
    }),
    { auth: withAuth },
  );
}

export async function listBestiaryPage(
  query: BestiaryListQuery = {},
  withAuth = true,
): Promise<PageResult<unknown>> {
  return readPage(
    await listBestiary(
      {
        limit: CATALOG_PAGE_SIZE,
        page: 1,
        ...query,
      },
      withAuth,
    ),
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
