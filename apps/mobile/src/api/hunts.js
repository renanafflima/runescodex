import { apiRequest } from "./client";
import { loadEntireCatalog } from "./page";

function withQuery(path, params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === "") return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export function listHunts({ vocation, difficulty, location, level, page, limit } = {}) {
  return apiRequest(
    withQuery("/hunts", { vocation, difficulty, location, level, page, limit }),
  );
}

export function listAllHunts() {
  return loadEntireCatalog((query) => listHunts(query || {}));
}

export function getHuntBySlug(slug) {
  return apiRequest(`/hunts/${encodeURIComponent(slug)}`);
}
