export function readPage(payload) {
  if (payload && Array.isArray(payload.items)) {
    return {
      items: payload.items,
      page: Number(payload.page) || 1,
      limit: Number(payload.limit) || payload.items.length,
      total: Number(payload.total) || 0,
      hasMore: payload.hasMore === true,
    };
  }
  const items = Array.isArray(payload) ? payload : [];
  return {
    items,
    page: 1,
    limit: items.length,
    total: items.length,
    hasMore: false,
  };
}

export async function collectPages(loadPage, maxPages = 100) {
  const items = [];
  let page = 1;
  let total = 0;
  while (page <= maxPages) {
    const result = readPage(await loadPage(page));
    items.push(...result.items);
    total = result.total;
    if (!result.hasMore || result.items.length === 0) break;
    page += 1;
  }
  return { items, total };
}
