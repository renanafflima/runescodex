import { apiRequest } from "./client";

export function syncStorePremium(token) {
  return apiRequest("/billing/revenuecat/sync", {
    method: "POST",
    token,
    body: {},
  });
}
