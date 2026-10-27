import { apiRequest } from "./client";

export type ReferralSummary = {
  referred: number;
  waitingPurchase: number;
  pendingDelivery: number;
  delivered: number;
  onHold: number;
  coinsDelivered: number;
};

export type ReferralAccount = {
  code: string;
  path: string;
  rewardCoins: number;
  summary: ReferralSummary;
  items: Array<{
    id: string;
    friend: string;
    createdAt: string;
    status: string;
    validatedAt: string | null;
    deliveredAt: string | null;
  }>;
  page: number;
  limit: number;
  total: number;
};

export function getMyReferrals(page = 1) {
  return apiRequest<ReferralAccount>(`/account/referrals?page=${page}`);
}

export function getAdminReferralOverview() {
  return apiRequest<{
    codes: number;
    attributions: number;
    waitingPurchase: number;
    pendingDelivery: number;
    delivered: number;
    onHold: number;
    ineligible: number;
    coinsPending: number;
    coinsDelivered: number;
  }>("/admin/referrals/overview");
}

export type AdminReferralRow = {
  id: string;
  code: string;
  stage: string;
  createdAt: string;
  referrer: { id: string; name: string; email: string };
  referred: { id: string; name: string; email: string };
  reward: { id: string; status: string; ticketId: string | null; orderId: string } | null;
};

export function listAdminReferrals(search = "") {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return apiRequest<{ items: AdminReferralRow[]; page: number; limit: number; total: number }>(
    `/admin/referrals${query}`,
  );
}

export function deliverReferralReward(id: string) {
  return apiRequest<{ delivered: boolean }>(`/admin/referrals/rewards/${id}/deliver`, {
    method: "POST",
    json: {},
  });
}
