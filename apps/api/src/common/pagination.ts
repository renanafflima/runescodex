export const PAGE_DEFAULT = 1;
export const PAGE_MAX = 1_000;
export const LIMIT_DEFAULT = 20;
export const LIMIT_MAX = 50;

export type PageQuery = {
  page?: number;
  limit?: number;
};

export function resolvePage(query: PageQuery = {}) {
  const requestedPage = query.page ?? PAGE_DEFAULT;
  const requestedLimit = query.limit ?? LIMIT_DEFAULT;
  const page = Math.min(Math.max(requestedPage, 1), PAGE_MAX);
  const limit = Math.min(Math.max(requestedLimit, 1), LIMIT_MAX);
  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

export function pageResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
) {
  return {
    items,
    page,
    limit,
    total,
    hasMore: page * limit < total,
  };
}
