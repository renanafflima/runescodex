import { apiRequest } from "./client";

export function prepareAdMobRewardedSession(token) {
  return apiRequest("/ads/admob/rewarded/prepare", {
    method: "POST",
    token,
  });
}

export function getAdMobRewardedSessionStatus(token, sessionId) {
  return apiRequest(`/ads/admob/rewarded/sessions/${encodeURIComponent(sessionId)}`, {
    token,
  });
}
