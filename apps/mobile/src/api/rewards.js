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

export function getRewardsMe(token) {
  return apiRequest("/rewards/me", { token });
}

export function listRewardMissions(token, period) {
  return apiRequest(withQuery("/rewards/missions", { period }), { token });
}

export function listRewardCatalog(token) {
  return apiRequest("/rewards/catalog", { token });
}

export function convertRewards(token, conversion, amount) {
  return apiRequest("/rewards/convert", {
    method: "POST",
    token,
    body: { conversion, amount },
  });
}

export function redeemReward(token, catalogItemId) {
  return apiRequest("/rewards/redeem", {
    method: "POST",
    token,
    body: { catalogItemId },
  });
}

export function listRewardRedemptions(token) {
  return apiRequest("/rewards/redemptions", { token });
}
