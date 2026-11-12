import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CharmGuideStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { CharmGuideCommentsService } from './charm-guide-comments.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('CharmGuideCommentsService', () => {
  let service: CharmGuideCommentsService;
  const prisma: any = {
    charmGuide: { findUnique: jest.fn() },
    charmGuideComment: { count: jest.fn(), findMany: jest.fn() },
    charmGuideCommentLike: { findMany: jest.fn(), groupBy: jest.fn() },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CharmGuideCommentsService,
        { provide: PrismaService, useValue: prisma },
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
});
