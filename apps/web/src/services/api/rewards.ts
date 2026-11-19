import { apiRequest, withQuery } from "./client";

export type RewardWallet = {
  points: number;
  gold: number;
  diamond: number;
};

export type RewardMission = {
  id: string;
  title: string;
  description: string;
  category: string;
  period: string;
  imageKey?: string | null;
  eventType?: string | null;
  catalogKey?: string | null;
  role?: string | null;
  eventImplemented?: boolean;
  functional?: boolean;
  current: number;
  target: number;
  rewardPoints: number;
  completed: boolean;
  periodEnd?: string;
  daysCompleted?: number;
  weeksCompleted?: number;
};

export type RewardCatalogItem = {
  id: string;
  name: string;
  description: string;
  imageKey?: string | null;
  currency: "GOLD" | "DIAMOND" | string;
  price: number;
  priceConfigured: boolean;
  premium?: boolean;
  redemptionCount?: number | null;
};

export type RewardRedemption = {
  id: string;
  name?: string;
  currency: string;
  price?: number;
  cost?: number;
  status: string;
  message?: string;
  adminNote?: string | null;
  createdAt?: string;
};

export type RewardPackage = {
  amount: number;
  pointsCost: number;
  goldGranted: number;
  enabled?: boolean;
};

export type RewardsMe = {
  wallet: RewardWallet;
  missions?: Record<string, { total: number; completed: number }>;
  conversions?: {
    pointsToGold?: RewardPackage[];
    goldToDiamond?: {
      enabled?: boolean;
      rate?: { goldCost: number; diamondGranted: number } | null;
    };
  };
};

export function getRewardsMe() {
  return apiRequest<RewardsMe>("/rewards/me");
}

export function listRewardMissions(period: string) {
  return apiRequest<RewardMission[]>(withQuery("/rewards/missions", { period }));
}

export type RewardsMissionsBoard = {
  DAILY: RewardMission[];
  WEEKLY: RewardMission[];
  MONTHLY: RewardMission[];
};

/** First-paint board: all three periods in one request. */
export function listRewardMissionsBoard() {
  return apiRequest<RewardsMissionsBoard>("/rewards/missions-board");
}

export function listRewardCatalog() {
  return apiRequest<RewardCatalogItem[]>("/rewards/catalog");
}

export function listRewardRedemptions() {
  return apiRequest<RewardRedemption[]>("/rewards/redemptions");
}

export function convertRewards(conversion: "POINTS_TO_GOLD" | "GOLD_TO_DIAMOND", amount: number) {
  return apiRequest<RewardWallet>("/rewards/convert", {
    method: "POST",
    json: { conversion, amount },
  });
}

export function redeemReward(catalogItemId: string) {
  return apiRequest<{ wallet: RewardWallet; redemption?: { status?: string; message?: string } }>("/rewards/redeem", {
    method: "POST",
    json: { catalogItemId },
  });
}

export function trackRewardActivity(eventType: string, referenceId: string, referenceType = "ClientActivity") {
  return apiRequest<{ eventType: string }>("/rewards/activity", {
    method: "POST",
    json: { eventType, referenceId, referenceType },
  });
}
