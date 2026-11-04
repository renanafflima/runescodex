import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import {
  BosstiaryCommentsService,
  REMOVED_BOSSTIARY_COMMENT_TEXT,
} from './bosstiary-comments.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const now = new Date('2026-11-04T12:00:00.000Z');

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'comment-1',
    content: 'Bom boss',
    isEdited: false,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    parentId: null,
    user: { id: 'user-a', activeCharacter: { name: 'Renan' } },
    ...overrides,
  };
}

describe('BosstiaryCommentsService', () => {
  let service: BosstiaryCommentsService;
  const prisma = {
    bosstiaryComment: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    bosstiaryCommentLike: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.bosstiaryCommentLike.groupBy.mockResolvedValue([]);
    prisma.bosstiaryCommentLike.findMany.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [BosstiaryCommentsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(BosstiaryCommentsService);
  });

  it('lists comments for a bosstiary slug without requiring a reviewed profile', async () => {
    prisma.bosstiaryComment.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    prisma.bosstiaryComment.findMany.mockResolvedValueOnce([row()]).mockResolvedValueOnce([]);
    const result = await service.list('ferumbras', {}, 'user-a');
    expect(result.items[0].user).toEqual({ id: 'user-a', name: 'Renan' });
  });

  it('creates a comment on a candidate slug', async () => {
    prisma.bosstiaryComment.create.mockResolvedValue(row());
    await service.create('ferumbras', 'user-a', { content: 'Bom boss' });
    expect(prisma.bosstiaryComment.create).toHaveBeenCalled();
  });

  it('soft-deletes an owned comment', async () => {
    prisma.bosstiaryComment.findFirst.mockResolvedValue({
      id: 'comment-1',
      slug: 'ferumbras',
      userId: 'user-a',
      isDeleted: false,
      parentId: null,
    });
    prisma.bosstiaryComment.update.mockResolvedValue(row({ isDeleted: true }));
    const removed = await service.remove('ferumbras', 'comment-1', 'user-a');
    expect(removed.content).toBe(REMOVED_BOSSTIARY_COMMENT_TEXT);
  });

  it('rejects editing someone else comment', async () => {
    prisma.bosstiaryComment.findFirst.mockResolvedValue({
      id: 'comment-1',
      slug: 'ferumbras',
      userId: 'user-b',
      isDeleted: false,
      parentId: null,
    });
    await expect(
      service.update('ferumbras', 'comment-1', 'user-a', { content: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a duplicate like', async () => {
    prisma.bosstiaryComment.findFirst.mockResolvedValue({
      id: 'comment-1',
      slug: 'ferumbras',
      userId: 'user-a',
      isDeleted: false,
      parentId: null,
    });
    prisma.bosstiaryCommentLike.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.like('ferumbras', 'comment-1', 'user-a')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects an invalid slug before touching the database', async () => {
    await expect(service.list('Ferumbras', {}, 'user-a')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.bosstiaryComment.count).not.toHaveBeenCalled();
  });

  it('returns not found when the comment does not belong to the slug', async () => {
    prisma.bosstiaryComment.findFirst.mockResolvedValue(null);
    await expect(service.like('ferumbras', 'comment-1', 'user-a')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
