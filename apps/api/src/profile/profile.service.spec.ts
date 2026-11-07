import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ContentSubject } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import {
  PROFILE_EMBLEM_CATALOG_IDS,
  PROFILE_EMBLEM_CRITERIA_STATUS,
  PROFILE_JOURNEY_XP_STATUS,
} from './profile.constants';
import { ProfileService } from './profile.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('ProfileService', () => {
  let service: ProfileService;
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    contentViewEvent: {
      groupBy: jest.fn(),
    },
    userBestiaryProgress: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    userMissionProgress: {
      count: jest.fn(),
    },
  };

  const createdAt = new Date('2025-02-15T10:00:00.000Z');

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [ProfileService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(ProfileService);
  });

  function stubEmptyUser() {
    prisma.user.findUnique.mockResolvedValue({
      createdAt,
      _count: { forumThreads: 0, forumReplies: 0, huntUpdateRequests: 0 },
    });
    prisma.contentViewEvent.groupBy.mockResolvedValue([]);
    prisma.userBestiaryProgress.count.mockResolvedValue(0);
    prisma.userMissionProgress.count.mockResolvedValue(0);
    prisma.userBestiaryProgress.findFirst.mockResolvedValue(null);
  }

  it('returns zeroed summary for a user without activity history', async () => {
    stubEmptyUser();

    const result = await service.getMe('user-empty');

    expect(result.memberSince).toBe(createdAt.toISOString());
    expect(result.journey.xpStatus).toBe(PROFILE_JOURNEY_XP_STATUS);
    expect(result.journey.level).toBeNull();
    expect(result.stats.contentViews).toEqual({
      hunts: 0,
      creatures: 0,
      bosses: 0,
      total: 0,
    });
    expect(result.stats.bestiary).toEqual({
      entriesWithProgress: 0,
      completed: 0,
    });
    expect(result.stats.rewardMissionsCompleted).toBe(0);
    expect(result.counts.activities).toBe(0);
    expect(result.emblems.unlockedIds).toEqual([]);
    expect(result.emblems.catalogTotal).toBe(PROFILE_EMBLEM_CATALOG_IDS.length);
    expect(result.emblems.criteriaStatus).toBe(PROFILE_EMBLEM_CRITERIA_STATUS);
    expect(result.bestiary.featured).toBeNull();
  });

  it('aggregates content view counts by subject for the authenticated user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      createdAt,
      _count: { forumThreads: 0, forumReplies: 0, huntUpdateRequests: 0 },
    });
    prisma.contentViewEvent.groupBy.mockResolvedValue([
      { subject: ContentSubject.HUNT, _count: { _all: 40 } },
      { subject: ContentSubject.CREATURE, _count: { _all: 12 } },
      { subject: ContentSubject.BOSS, _count: { _all: 3 } },
    ]);
    prisma.userBestiaryProgress.count.mockResolvedValue(0);
    prisma.userMissionProgress.count.mockResolvedValue(0);
    prisma.userBestiaryProgress.findFirst.mockResolvedValue(null);

    const result = await service.getMe('user-views');

    expect(prisma.contentViewEvent.groupBy).toHaveBeenCalledWith({
      by: ['subject'],
      where: { userId: 'user-views' },
      _count: { _all: true },
    });
    expect(result.stats.contentViews).toEqual({
      hunts: 40,
      creatures: 12,
      bosses: 3,
      total: 55,
    });
    expect(result.journey.highlights.trackedContentViews).toBe(55);
  });

  it('includes forum, hunt update, bestiary and mission metrics', async () => {
    prisma.user.findUnique.mockResolvedValue({
      createdAt,
      _count: { forumThreads: 2, forumReplies: 5, huntUpdateRequests: 1 },
    });
    prisma.contentViewEvent.groupBy.mockResolvedValue([
      { subject: ContentSubject.HUNT, _count: { _all: 10 } },
    ]);
    prisma.userBestiaryProgress.count
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(3);
    prisma.userMissionProgress.count.mockResolvedValue(4);
    const completedAt = new Date('2026-03-01T12:00:00.000Z');
    prisma.userBestiaryProgress.findFirst
      .mockResolvedValueOnce({
        kills: 500,
        completed: true,
        completedAt,
        creature: { id: 'c-1', name: 'Dragon', slug: 'dragon' },
      })
      .mockResolvedValueOnce(null);

    const result = await service.getMe('user-active');

    expect(result.stats.forumThreads).toBe(2);
    expect(result.stats.forumReplies).toBe(5);
    expect(result.stats.forumParticipation).toBe(7);
    expect(result.stats.huntUpdateRequests).toBe(1);
    expect(result.stats.bestiary).toEqual({
      entriesWithProgress: 8,
      completed: 3,
    });
    expect(result.stats.rewardMissionsCompleted).toBe(4);
    expect(result.counts.activities).toBe(10 + 7 + 1 + 4);
    expect(result.bestiary.featured).toEqual({
      creatureId: 'c-1',
      name: 'Dragon',
      slug: 'dragon',
      kills: 500,
      completed: true,
      completedAt: completedAt.toISOString(),
    });
  });

  it('uses highest-kill progress as featured when nothing is completed', async () => {
    prisma.user.findUnique.mockResolvedValue({
      createdAt,
      _count: { forumThreads: 0, forumReplies: 0, huntUpdateRequests: 0 },
    });
    prisma.contentViewEvent.groupBy.mockResolvedValue([]);
    prisma.userBestiaryProgress.count.mockResolvedValue(1);
    prisma.userMissionProgress.count.mockResolvedValue(0);
    prisma.userBestiaryProgress.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        kills: 42,
        completed: false,
        completedAt: null,
        creature: { id: 'c-2', name: 'Rat', slug: 'rat' },
      });

    const result = await service.getMe('user-bestiary');

    expect(result.bestiary.featured?.slug).toBe('rat');
    expect(result.bestiary.featured?.kills).toBe(42);
    expect(result.bestiary.featured?.completed).toBe(false);
  });

  it('scopes every query to the jwt user id without accepting another id in filters', async () => {
    stubEmptyUser();

    await service.getMe('user-scoped');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-scoped' },
      select: expect.any(Object),
    });
    expect(prisma.contentViewEvent.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-scoped' } }),
    );
    expect(prisma.userBestiaryProgress.count).toHaveBeenCalledWith({
      where: { userId: 'user-scoped' },
    });
    expect(prisma.userBestiaryProgress.count).toHaveBeenCalledWith({
      where: { userId: 'user-scoped', completed: true },
    });
    expect(prisma.userMissionProgress.count).toHaveBeenCalledWith({
      where: { userId: 'user-scoped', completed: true },
    });
    expect(prisma.userBestiaryProgress.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-scoped', completed: true } }),
    );
    expect(prisma.userBestiaryProgress.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-scoped', kills: { gt: 0 } },
      }),
    );
  });

  it('throws when the user record is missing', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.contentViewEvent.groupBy.mockResolvedValue([]);
    prisma.userBestiaryProgress.count.mockResolvedValue(0);
    prisma.userMissionProgress.count.mockResolvedValue(0);
    prisma.userBestiaryProgress.findFirst.mockResolvedValue(null);

    await expect(service.getMe('ghost')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('propagates prisma failures', async () => {
    prisma.user.findUnique.mockRejectedValue(new Error('db down'));
    prisma.contentViewEvent.groupBy.mockResolvedValue([]);
    prisma.userBestiaryProgress.count.mockResolvedValue(0);
    prisma.userMissionProgress.count.mockResolvedValue(0);
    prisma.userBestiaryProgress.findFirst.mockResolvedValue(null);

    await expect(service.getMe('user-err')).rejects.toThrow('db down');
  });
});
