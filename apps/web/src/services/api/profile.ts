import { apiRequest } from "./client";

export type ProfileXpStatus = "PENDING_DEFINITION";

export type ProfileEmblemCriteriaStatus = "PENDING";

export type ProfileContentViewCounts = {
  hunts: number;
  creatures: number;
  bosses: number;
  total: number;
};

export type ProfileFeaturedCreature = {
  creatureId: string;
  name: string;
  slug: string;
  kills: number;
  completed: boolean;
  completedAt: string | null;
};

export type ProfileMeResponse = {
  memberSince: string;
  journey: {
    xpStatus: ProfileXpStatus;
    level: null;
    currentXp: null;
    nextLevelXp: null;
    progressRatio: null;
    highlights: {
      emblemsUnlocked: number;
      rewardMissionsCompleted: number;
      trackedContentViews: number;
      forumParticipation: number;
      memberMonths: number;
    };
  };
  stats: {
    contentViews: ProfileContentViewCounts;
    bestiary: {
      entriesWithProgress: number;
      completed: number;
    };
    forumThreads: number;
    forumReplies: number;
    forumParticipation: number;
    huntUpdateRequests: number;
    rewardMissionsCompleted: number;
  };
  counts: {
    activities: number;
  };
  emblems: {
    criteriaStatus: ProfileEmblemCriteriaStatus;
    catalogTotal: number;
    unlockedCount: number;
    unlockedIds: string[];
  };
  bestiary: {
    featured: ProfileFeaturedCreature | null;
  };
};

export function getProfileMe() {
  return apiRequest<ProfileMeResponse>("/profile/me");
}
