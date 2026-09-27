import { apiRequest } from "./client";
import { invalidateRewardReads } from "./rewardReads";

function withQuery(path, params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === "") return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export function listForumThreads({ status, page, limit } = {}, token) {
  return apiRequest(withQuery("/forum", { status, page, limit }), { token });
}

export function getForumThread(id, token) {
  return apiRequest(`/forum/${encodeURIComponent(id)}`, { token });
}

export async function createForumThread(token, payload) {
  const thread = await apiRequest("/forum", {
    method: "POST",
    token,
    body: payload,
  });
  invalidateRewardReads(token);
  return thread;
}

export async function createForumReply(token, id, payload) {
  const thread = await apiRequest(`/forum/${encodeURIComponent(id)}/replies`, {
    method: "POST",
    token,
    body: payload,
  });
  invalidateRewardReads(token);
  return thread;
}

export function closeForumThread(token, id) {
  return apiRequest(`/forum/${encodeURIComponent(id)}/close`, {
    method: "PATCH",
    token,
  });
}
