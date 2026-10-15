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
  current: number;
  target: number;
  rewardPoints: number;
  completed: boolean;
};

export type RewardCatalogItem = {
  id: string;
  name: string;
  description: string;
  currency: "GOLD" | "DIAMOND" | string;
  price: number;
  priceConfigured: boolean;
};

export type RewardRedemption = {
  id: string;
  name?: string;
  currency: string;
  price?: number;
  cost?: number;
  status: string;
  message?: string;
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
  return apiRequest<{ wallet: RewardWallet }>("/rewards/redeem", {
    method: "POST",
    json: { catalogItemId },
  });
}
