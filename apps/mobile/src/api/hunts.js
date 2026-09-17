import { apiRequest } from "./client";

function withQuery(path, params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === "") return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export function listHunts({ vocation, difficulty, location, level } = {}) {
  return apiRequest(
    withQuery("/hunts", { vocation, difficulty, location, level }),
  );
}

export function getHuntBySlug(slug) {
  return apiRequest(`/hunts/${encodeURIComponent(slug)}`);
}
