import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ContentSubject } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import {
  PROFILE_EMBLEM_CATALOG_IDS,
  PROFILE_EMBLEM_CRITERIA_STATUS,
  PROFILE_JOURNEY_XP_STATUS,
} from './profile.constants';

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
    xpStatus: typeof PROFILE_JOURNEY_XP_STATUS;
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
    criteriaStatus: typeof PROFILE_EMBLEM_CRITERIA_STATUS;
    catalogTotal: number;
    unlockedCount: number;
    unlockedIds: string[];
  };
  bestiary: {
    featured: ProfileFeaturedCreature | null;
  };
};

function memberMonths(createdAt: Date, now = new Date()) {
  let months =
    (now.getFullYear() - createdAt.getFullYear()) * 12 +
    (now.getMonth() - createdAt.getMonth());
  if (now.getDate() < createdAt.getDate()) {
    months -= 1;
  }
  return Math.max(0, months);
}

function mapContentViews(
  rows: Array<{ subject: ContentSubject; _count: { _all: number } }>,
): ProfileContentViewCounts {
  const tallies = {
    [ContentSubject.HUNT]: 0,
    [ContentSubject.CREATURE]: 0,
    [ContentSubject.BOSS]: 0,
  };
  for (const row of rows) {
    tallies[row.subject] = row._count._all;
  }
  const hunts = tallies[ContentSubject.HUNT];
  const creatures = tallies[ContentSubject.CREATURE];
  const bosses = tallies[ContentSubject.BOSS];
  return {
    hunts,
    creatures,
    bosses,
    total: hunts + creatures + bosses,
  };
}

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string): Promise<ProfileMeResponse> {
    const [
      user,
      viewGroups,
      bestiaryEntriesWithProgress,
      bestiaryCompleted,
      rewardMissionsCompleted,
      featuredCompleted,
      featuredByKills,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          createdAt: true,
          _count: {
            select: {
              forumThreads: true,
              forumReplies: true,
              huntUpdateRequests: true,
            },
          },
        },
      }),
      this.prisma.contentViewEvent.groupBy({
        by: ['subject'],
        where: { userId },
        _count: { _all: true },
      }),
      this.prisma.userBestiaryProgress.count({ where: { userId } }),
      this.prisma.userBestiaryProgress.count({
        where: { userId, completed: true },
      }),
      this.prisma.userMissionProgress.count({
        where: { userId, completed: true },
      }),
      this.prisma.userBestiaryProgress.findFirst({
        where: { userId, completed: true },
        orderBy: { completedAt: 'desc' },
        select: {
          kills: true,
          completed: true,
          completedAt: true,
          creature: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.userBestiaryProgress.findFirst({
        where: { userId, kills: { gt: 0 } },
        orderBy: [{ kills: 'desc' }, { updatedAt: 'desc' }],
        select: {
          kills: true,
          completed: true,
          completedAt: true,
          creature: { select: { id: true, name: true, slug: true } },
        },
      }),
    ]);

    if (!user) {
      throw new UnauthorizedException();
    }

    const contentViews = mapContentViews(viewGroups);
    const forumThreads = user._count.forumThreads;
    const forumReplies = user._count.forumReplies;
    const forumParticipation = forumThreads + forumReplies;
    const huntUpdateRequests = user._count.huntUpdateRequests;
    const months = memberMonths(user.createdAt);

    const featuredRow = featuredCompleted ?? featuredByKills ?? null;
    const featured = featuredRow
      ? {
          creatureId: featuredRow.creature.id,
          name: featuredRow.creature.name,
          slug: featuredRow.creature.slug,
          kills: featuredRow.kills,
          completed: featuredRow.completed,
          completedAt: featuredRow.completedAt
            ? featuredRow.completedAt.toISOString()
            : null,
        }
      : null;

    const activities =
      contentViews.total +
      forumParticipation +
      huntUpdateRequests +
      rewardMissionsCompleted;

    return {
      memberSince: user.createdAt.toISOString(),
      journey: {
        xpStatus: PROFILE_JOURNEY_XP_STATUS,
        level: null,
        currentXp: null,
        nextLevelXp: null,
        progressRatio: null,
        highlights: {
          emblemsUnlocked: 0,
          rewardMissionsCompleted,
          trackedContentViews: contentViews.total,
          forumParticipation,
          memberMonths: months,
        },
      },
      stats: {
        contentViews,
        bestiary: {
          entriesWithProgress: bestiaryEntriesWithProgress,
          completed: bestiaryCompleted,
        },
        forumThreads,
        forumReplies,
        forumParticipation,
        huntUpdateRequests,
        rewardMissionsCompleted,
      },
      counts: {
        activities,
      },
      emblems: {
        criteriaStatus: PROFILE_EMBLEM_CRITERIA_STATUS,
        catalogTotal: PROFILE_EMBLEM_CATALOG_IDS.length,
        unlockedCount: 0,
        unlockedIds: [],
      },
      bestiary: {
        featured,
      },
    };
  }
}
