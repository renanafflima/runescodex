import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CharmGuideStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { RewardsService } from '../rewards/rewards.service';
import { CharmGuideCommentsService } from './charm-guide-comments.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('CharmGuideCommentsService', () => {
  let service: CharmGuideCommentsService;
  const rewards = { recordEvent: jest.fn().mockResolvedValue({ applied: [] }) };
  const prisma: any = {
    charmGuide: { findUnique: jest.fn() },
    charmGuideComment: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    charmGuideCommentLike: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
      createMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    rewards.recordEvent.mockResolvedValue({ applied: [] });
    const moduleRef = await Test.createTestingModule({
      providers: [
        CharmGuideCommentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RewardsService, useValue: rewards },
      ],
    }).compile();
    service = moduleRef.get(CharmGuideCommentsService);
  });

  it('404s comment listing for unpublished guides of other users', async () => {
    prisma.charmGuide.findUnique.mockResolvedValue({
      status: CharmGuideStatus.PENDING_REVIEW,
      userId: 'owner',
    });
    await expect(
      service.list('guide-1', { page: 1, limit: 20 }, 'other'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.charmGuideComment.findMany).not.toHaveBeenCalled();
  });

  it('404s comment listing when the guide does not exist', async () => {
    prisma.charmGuide.findUnique.mockResolvedValue(null);
    await expect(
      service.list('missing', { page: 1, limit: 20 }, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists comments for the author of a pending guide without treating it as missing', async () => {
    prisma.charmGuide.findUnique.mockResolvedValue({
      status: CharmGuideStatus.PENDING_REVIEW,
      userId: 'owner',
    });
    prisma.charmGuideComment.count.mockResolvedValue(0);
    prisma.charmGuideComment.findMany.mockResolvedValue([]);
    prisma.charmGuideCommentLike.findMany.mockResolvedValue([]);
    prisma.charmGuideCommentLike.groupBy.mockResolvedValue([]);

    const page = await service.list('guide-1', { page: 1, limit: 20 }, 'owner');
    expect(page.items).toEqual([]);
    expect(page.total).toBe(0);
  });

  it('lists comments on published guides for any authenticated user', async () => {
    prisma.charmGuide.findUnique.mockResolvedValue({
      status: CharmGuideStatus.PUBLISHED,
      userId: 'owner',
    });
    prisma.charmGuideComment.count.mockResolvedValue(0);
    prisma.charmGuideComment.findMany.mockResolvedValue([]);
    prisma.charmGuideCommentLike.findMany.mockResolvedValue([]);
    prisma.charmGuideCommentLike.groupBy.mockResolvedValue([]);

    const page = await service.list('guide-1', { page: 1, limit: 20 }, 'other');
    expect(page.items).toEqual([]);
  });

  it('emits FORUM_COMMENT_CREATED when a charm guide comment is created', async () => {
    prisma.charmGuide.findUnique.mockResolvedValue({
      status: CharmGuideStatus.PUBLISHED,
      userId: 'owner',
    });
    prisma.charmGuideComment.create.mockResolvedValue({
      id: 'comment-1',
      guideId: 'guide-1',
      userId: 'user-1',
      parentId: null,
      content: 'Great guide',
      isEdited: false,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { id: 'user-1', activeCharacter: { name: 'Knight' } },
    });

    await service.create('guide-1', 'user-1', { content: 'Great guide' });

    expect(rewards.recordEvent).toHaveBeenCalledWith(
      'user-1',
      'FORUM_COMMENT_CREATED',
      { referenceType: 'CharmGuideComment', referenceId: 'comment-1' },
    );
  });

  it('emits COMMUNITY_CONTENT_LIKED only on the first like', async () => {
    prisma.charmGuideComment.findFirst.mockResolvedValue({
      id: 'comment-1',
      guideId: 'guide-1',
      isDeleted: false,
    });
    prisma.charmGuideCommentLike.createMany.mockResolvedValue({ count: 1 });

    await service.like('guide-1', 'comment-1', 'user-1');
    expect(rewards.recordEvent).toHaveBeenCalledWith(
      'user-1',
      'COMMUNITY_CONTENT_LIKED',
      {
        referenceType: 'CharmGuideCommentLike',
        referenceId: 'comment-1:user-1',
      },
    );

    rewards.recordEvent.mockClear();
    prisma.charmGuideCommentLike.createMany.mockResolvedValue({ count: 0 });
    await service.like('guide-1', 'comment-1', 'user-1');
    expect(rewards.recordEvent).not.toHaveBeenCalled();
  });
});
