export const CATALOG_PAGE_SIZE = 50;

/** Bosstiary encyclopedia: active rows can exceed global API page cap (50). */
export const BOSSTIARY_ENCYCLOPEDIA_PAGE_SIZE = 100;

export type PageResult<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export function readPage<T>(payload: unknown): PageResult<T> {
  if (payload && typeof payload === "object" && "items" in payload) {
    const data = payload as {
      items?: unknown;
      page?: unknown;
      limit?: unknown;
      total?: unknown;
      hasMore?: unknown;
    };
    const items = Array.isArray(data.items) ? (data.items as T[]) : [];
    const page = Number(data.page) || 1;
    const limit = Number(data.limit) || items.length || 1;
    const total = Number(data.total) ?? 0;
    const hasMore = resolveHasMore(data.hasMore, page, limit, total, items.length);
    return {
      items,
      page,
      limit,
      total,
      hasMore,
    };
  }

  const items = Array.isArray(payload) ? (payload as T[]) : [];
  return {
    items,
    page: 1,
    limit: items.length,
    total: items.length,
    hasMore: false,
  };
}

function resolveHasMore(
  explicit: unknown,
  page: number,
  limit: number,
  total: number,
  itemCount: number,
): boolean {
  if (explicit === true) return true;
  if (explicit === false) {
    if (total > 0) return page * limit < total;
    return false;
  }
  if (total > 0) return page * limit < total;
  return itemCount >= limit && itemCount > 0;
}

export async function collectPages<T>(
  loadPage: (page: number) => Promise<unknown>,
  maxPages = 100,
): Promise<{ items: T[]; total: number }> {
  const items: T[] = [];
  let page = 1;
  let total = 0;

  while (page <= maxPages) {
    const result = readPage<T>(await loadPage(page));
    if (result.items.length > 0) {
      items.push(...result.items);
    }
    if (result.total > 0) {
      total = result.total;
    }
    if (result.items.length === 0) break;
    const collectedAll = total > 0 && items.length >= total;
    if (collectedAll) break;
    if (!result.hasMore) break;
    page += 1;
  }

  return { items, total };
}

export async function loadEntireCatalog<T>(
  fetchPage: (query?: { page?: number; limit?: number }) => Promise<unknown>,
  options: { pageSize?: number; maxPages?: number } = {},
) {
  const pageSize = options.pageSize ?? CATALOG_PAGE_SIZE;
  const collected = await collectPages<T>(
    (page) => fetchPage({ page, limit: pageSize }),
    options.maxPages ?? 100,
  );
  return collected.items;
}
