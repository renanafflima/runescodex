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
    return {
      items,
      page: Number(data.page) || 1,
      limit: Number(data.limit) || items.length,
      total: Number(data.total) || 0,
      hasMore: data.hasMore === true,
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

export async function collectPages<T>(
  loadPage: (page: number) => Promise<unknown>,
  maxPages = 100,
): Promise<{ items: T[]; total: number }> {
  const items: T[] = [];
  let page = 1;
  let total = 0;

  while (page <= maxPages) {
    const result = readPage<T>(await loadPage(page));
    items.push(...result.items);
    total = result.total;
    if (!result.hasMore || result.items.length === 0) break;
    page += 1;
  }

  return { items, total };
}

export async function loadEntireCatalog<T>(
  fetchPage: (query?: { page?: number; limit?: number }) => Promise<unknown>,
) {
  const first = await fetchPage();
  const parsed = readPage<T>(first);
  if (!parsed.hasMore) return parsed.items;
  const collected = await collectPages<T>((page) =>
    fetchPage({ page, limit: 50 }),
  );
  return collected.items;
}
