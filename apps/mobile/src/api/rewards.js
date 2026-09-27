import { apiRequest } from "./client";
import { invalidateRewardReads, rewardReadKey, rewardReads } from "./rewardReads";

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
  const path = "/rewards/me";
  return rewardReads.read(rewardReadKey(token, path), () => apiRequest(path, { token }));
}

export function listRewardMissions(token, period) {
  const path = withQuery("/rewards/missions", { period });
  return rewardReads.read(rewardReadKey(token, path), () => apiRequest(path, { token }));
}

export function listRewardCatalog(token) {
  return apiRequest("/rewards/catalog", { token });
}

export async function convertRewards(token, conversion, amount) {
  const wallet = await apiRequest("/rewards/convert", {
    method: "POST",
    token,
    body: { conversion, amount },
  });
  invalidateRewardReads(token);
  return wallet;
}

export async function redeemReward(token, catalogItemId) {
  const result = await apiRequest("/rewards/redeem", {
    method: "POST",
    token,
    body: { catalogItemId },
  });
  invalidateRewardReads(token);
  return result;
}

export function listRewardRedemptions(token) {
  return apiRequest("/rewards/redemptions", { token });
}
