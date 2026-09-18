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

export function listForumThreads({ status } = {}, token) {
  return apiRequest(withQuery("/forum", { status }), { token });
}

export function getForumThread(id, token) {
  return apiRequest(`/forum/${encodeURIComponent(id)}`, { token });
}

export function createForumThread(token, payload) {
  return apiRequest("/forum", {
    method: "POST",
    token,
    body: payload,
  });
}

export function createForumReply(token, id, payload) {
  return apiRequest(`/forum/${encodeURIComponent(id)}/replies`, {
    method: "POST",
    token,
    body: payload,
  });
}

export function closeForumThread(token, id) {
  return apiRequest(`/forum/${encodeURIComponent(id)}/close`, {
    method: "PATCH",
    token,
  });
}
