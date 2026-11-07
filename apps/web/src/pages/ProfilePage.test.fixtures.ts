import type { ProfileMeResponse } from "../services/api/profile";

export const emptyProfileMe: ProfileMeResponse = {
  memberSince: "2026-01-15T12:00:00.000Z",
  journey: {
    xpStatus: "PENDING_DEFINITION",
    level: null,
    currentXp: null,
    nextLevelXp: null,
    progressRatio: null,
    highlights: {
      emblemsUnlocked: 0,
      rewardMissionsCompleted: 0,
      trackedContentViews: 0,
      forumParticipation: 0,
      memberMonths: 0,
    },
  },
  stats: {
    contentViews: { hunts: 0, creatures: 0, bosses: 0, total: 0 },
    bestiary: { entriesWithProgress: 0, completed: 0 },
    forumThreads: 0,
    forumReplies: 0,
    forumParticipation: 0,
    huntUpdateRequests: 0,
    rewardMissionsCompleted: 0,
  },
  counts: { activities: 0 },
  emblems: {
    criteriaStatus: "PENDING",
    catalogTotal: 12,
    unlockedCount: 0,
    unlockedIds: [],
  },
  bestiary: { featured: null },
};

export const activeProfileMe: ProfileMeResponse = {
  ...emptyProfileMe,
  journey: {
    ...emptyProfileMe.journey,
    highlights: {
      emblemsUnlocked: 0,
      rewardMissionsCompleted: 4,
      trackedContentViews: 55,
      forumParticipation: 7,
      memberMonths: 3,
    },
  },
  stats: {
    contentViews: { hunts: 40, creatures: 12, bosses: 3, total: 55 },
    bestiary: { entriesWithProgress: 8, completed: 3 },
    forumThreads: 2,
    forumReplies: 5,
    forumParticipation: 7,
    huntUpdateRequests: 1,
    rewardMissionsCompleted: 4,
  },
  counts: { activities: 67 },
  bestiary: {
    featured: {
      creatureId: "creature-1",
      name: "Dragon",
      slug: "dragon",
      kills: 500,
      completed: true,
      completedAt: "2026-03-01T12:00:00.000Z",
    },
  },
};
