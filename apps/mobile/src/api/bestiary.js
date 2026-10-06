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

export function listBestiary({ difficulty, page, limit } = {}, token) {
  return apiRequest(withQuery("/bestiary", { difficulty, page, limit }), { token });
}

export function listAllBestiary(token) {
  return loadEntireCatalog((query) => listBestiary(query || {}, token));
}
