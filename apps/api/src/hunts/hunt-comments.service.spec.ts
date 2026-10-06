import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateHuntCommentDto,
  HUNT_COMMENT_MAX_LENGTH,
} from './dto/create-hunt-comment.dto';
import { UpdateHuntCommentDto } from './dto/update-hunt-comment.dto';
import {
  HuntCommentsService,
  REMOVED_COMMENT_TEXT,
} from './hunt-comments.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const now = new Date('2026-10-05T12:00:00.000Z');

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'comment-1',
    content: 'Boa hunt',
    isEdited: false,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    parentId: null,
    user: { id: 'user-a', activeCharacter: { name: 'Renan' } },
    ...overrides,
  };
}

describe('HuntCommentsService', () => {
  let service: HuntCommentsService;
  const prisma = {
    hunt: { findFirst: jest.fn() },
    huntComment: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    huntCommentLike: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.hunt.findFirst.mockResolvedValue({ id: 'hunt-1' });
    prisma.huntCommentLike.groupBy.mockResolvedValue([]);
    prisma.huntCommentLike.findMany.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        HuntCommentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(HuntCommentsService);
  });

  it('lists comments with replies and like counts for an existing hunt', async () => {
    prisma.huntComment.count.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    prisma.huntComment.findMany
      .mockResolvedValueOnce([row()])
      .mockResolvedValueOnce([
        row({
          id: 'reply-1',
          parentId: 'comment-1',
          content: 'Concordo',
          user: { id: 'user-b', activeCharacter: null },
        }),
      ]);
    prisma.huntCommentLike.groupBy.mockResolvedValue([
      { commentId: 'comment-1', _count: { _all: 2 } },
    ]);
    prisma.huntCommentLike.findMany.mockResolvedValue([
      { commentId: 'comment-1' },
    ]);

    const result = await service.list('cyclops', {}, 'user-a');

    expect(result.total).toBe(1);
    expect(result.commentCount).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].likesCount).toBe(2);
    expect(result.items[0].likedByMe).toBe(true);
    expect(result.items[0].user).toEqual({ id: 'user-a', name: 'Renan' });
    expect(result.items[0].replies).toHaveLength(1);
    expect(result.items[0].replies[0].user).toEqual({
      id: 'user-b',
      name: null,
    });
    expect(prisma.huntCommentLike.groupBy).toHaveBeenCalledTimes(1);
  });

  it('returns an empty page when the hunt has no comments', async () => {
    prisma.huntComment.count.mockResolvedValue(0);
    prisma.huntComment.findMany.mockResolvedValue([]);

    const result = await service.list('cyclops', {});

    expect(result.items).toEqual([]);
    expect(result.commentCount).toBe(0);
    expect(result.hasMore).toBe(false);
    expect(prisma.huntCommentLike.groupBy).not.toHaveBeenCalled();
  });

  it('throws when the hunt does not exist', async () => {
    prisma.hunt.findFirst.mockResolvedValue(null);

    await expect(service.list('missing', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('masks a removed comment and keeps its reply', async () => {
    prisma.huntComment.count.mockResolvedValue(2);
    prisma.huntComment.findMany
      .mockResolvedValueOnce([row({ isDeleted: true, content: 'segredo' })])
      .mockResolvedValueOnce([
        row({ id: 'reply-1', parentId: 'comment-1', content: 'ainda aqui' }),
      ]);

    const result = await service.list('cyclops', {});

    expect(result.items[0].content).toBe(REMOVED_COMMENT_TEXT);
    expect(result.items[0].isDeleted).toBe(true);
    expect(result.items[0].replies[0].content).toBe('ainda aqui');
  });

  it('creates a comment for the authenticated user', async () => {
    prisma.huntComment.create.mockResolvedValue(row({ content: 'Olá' }));

    const result = await service.create('cyclops', 'user-a', {
      content: 'Olá',
    });

    expect(prisma.huntComment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          huntId: 'hunt-1',
          userId: 'user-a',
          parentId: null,
          content: 'Olá',
        },
      }),
    );
    expect(result.content).toBe('Olá');
    expect(result.replies).toEqual([]);
  });

  it('rejects a missing hunt, a missing parent, a parent from another hunt, and a nested reply', async () => {
    prisma.hunt.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.create('missing', 'user-a', { content: 'Olá' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.hunt.findFirst.mockResolvedValue({ id: 'hunt-1' });
    prisma.huntComment.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.create('cyclops', 'user-a', {
        content: 'Olá',
        parentId: '00000000-0000-4000-8000-000000000001',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.huntComment.findFirst.mockResolvedValueOnce({
      id: 'parent',
      huntId: 'other-hunt',
      parentId: null,
      isDeleted: false,
    });
    await expect(
      service.create('cyclops', 'user-a', {
        content: 'Olá',
        parentId: '00000000-0000-4000-8000-000000000002',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.huntComment.findFirst.mockResolvedValueOnce({
      id: 'reply',
      huntId: 'hunt-1',
      parentId: 'root',
      isDeleted: false,
    });
    await expect(
      service.create('cyclops', 'user-a', {
        content: 'Olá',
        parentId: '00000000-0000-4000-8000-000000000003',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.huntComment.create).not.toHaveBeenCalled();
  });

  it('creates a reply when the parent belongs to the same hunt', async () => {
    prisma.huntComment.findFirst.mockResolvedValue({
      id: 'parent',
      huntId: 'hunt-1',
      parentId: null,
      isDeleted: false,
    });
    prisma.huntComment.create.mockResolvedValue(
      row({ id: 'reply-1', parentId: 'parent', content: 'Resposta' }),
    );

    await service.create('cyclops', 'user-a', {
      content: 'Resposta',
      parentId: 'parent',
    });

    expect(prisma.huntComment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expectObject({
          huntId: 'hunt-1',
          userId: 'user-a',
          parentId: 'parent',
          content: 'Resposta',
        }),
      }),
    );
  });

  it('lets the author edit and marks the comment as edited', async () => {
    prisma.huntComment.findFirst.mockResolvedValue({
      id: 'comment-1',
      huntId: 'hunt-1',
      userId: 'user-a',
      isDeleted: false,
      parentId: null,
    });
    prisma.huntComment.update.mockResolvedValue(
      row({ content: 'Atualizado', isEdited: true }),
    );

    const result = await service.update('cyclops', 'comment-1', 'user-a', {
      content: 'Atualizado',
    });

    expect(prisma.huntComment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'comment-1' },
        data: { content: 'Atualizado', isEdited: true },
      }),
    );
    expect(result.isEdited).toBe(true);
  });

  it('rejects edits from another user, a missing comment, and a removed comment', async () => {
    prisma.huntComment.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.update('cyclops', 'missing', 'user-a', { content: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.huntComment.findFirst.mockResolvedValueOnce({
      id: 'comment-1',
      huntId: 'hunt-1',
      userId: 'user-b',
      isDeleted: false,
      parentId: null,
    });
    await expect(
      service.update('cyclops', 'comment-1', 'user-a', { content: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    prisma.huntComment.findFirst.mockResolvedValueOnce({
      id: 'comment-1',
      huntId: 'hunt-1',
      userId: 'user-a',
      isDeleted: true,
      parentId: null,
    });
    await expect(
      service.update('cyclops', 'comment-1', 'user-a', { content: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.huntComment.update).not.toHaveBeenCalled();
  });

  it('soft-deletes the author comment and keeps the row', async () => {
    prisma.huntComment.findFirst.mockResolvedValue({
      id: 'comment-1',
      huntId: 'hunt-1',
      userId: 'user-a',
      isDeleted: false,
      parentId: null,
    });
    prisma.huntComment.update.mockResolvedValue(row({ isDeleted: true }));

    const result = await service.remove('cyclops', 'comment-1', 'user-a');

    expect(prisma.huntComment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'comment-1' },
        data: { isDeleted: true },
      }),
    );
    expect(result.content).toBe(REMOVED_COMMENT_TEXT);
    expect(result.isDeleted).toBe(true);
  });

  it('rejects deletion by another user and a missing comment', async () => {
    prisma.huntComment.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.remove('cyclops', 'missing', 'user-a'),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.huntComment.findFirst.mockResolvedValueOnce({
      id: 'comment-1',
      huntId: 'hunt-1',
      userId: 'user-b',
      isDeleted: false,
      parentId: null,
    });
    await expect(
      service.remove('cyclops', 'comment-1', 'user-a'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates a like and rejects a duplicate', async () => {
    prisma.huntComment.findFirst.mockResolvedValue({
      id: 'comment-1',
      huntId: 'hunt-1',
      userId: 'user-b',
      isDeleted: false,
      parentId: null,
    });
    prisma.huntCommentLike.create.mockResolvedValue({ id: 'like-1' });
    prisma.huntCommentLike.groupBy.mockResolvedValue([
      { commentId: 'comment-1', _count: { _all: 1 } },
    ]);

    const liked = await service.like('cyclops', 'comment-1', 'user-a');
    expect(liked).toEqual({
      commentId: 'comment-1',
      likesCount: 1,
      likedByMe: true,
    });
    expect(prisma.huntCommentLike.create).toHaveBeenCalledWith({
      data: { commentId: 'comment-1', userId: 'user-a' },
    });

    prisma.huntCommentLike.create.mockRejectedValueOnce({ code: 'P2002' });
    await expect(
      service.like('cyclops', 'comment-1', 'user-a'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('removes only the authenticated user like', async () => {
    prisma.huntComment.findFirst.mockResolvedValue({
      id: 'comment-1',
      huntId: 'hunt-1',
      userId: 'user-b',
      isDeleted: false,
      parentId: null,
    });
    prisma.huntCommentLike.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.unlike('cyclops', 'comment-1', 'user-b'),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.huntCommentLike.deleteMany.mockResolvedValueOnce({ count: 1 });
    prisma.huntCommentLike.groupBy.mockResolvedValue([]);
    const removed = await service.unlike('cyclops', 'comment-1', 'user-a');

    expect(prisma.huntCommentLike.deleteMany).toHaveBeenLastCalledWith({
      where: { commentId: 'comment-1', userId: 'user-a' },
    });
    expect(removed.likedByMe).toBe(false);
  });
});

function expectObject<T extends Record<string, unknown>>(value: T) {
  return value;
}

describe('hunt comment validation', () => {
  it('trims content and rejects empty or oversized text', async () => {
    const valid = plainToInstance(CreateHuntCommentDto, { content: '  ok  ' });
    const empty = plainToInstance(CreateHuntCommentDto, { content: '   ' });
    const huge = plainToInstance(UpdateHuntCommentDto, {
      content: 'a'.repeat(HUNT_COMMENT_MAX_LENGTH + 1),
    });

    expect(await validate(valid)).toHaveLength(0);
    expect(valid.content).toBe('ok');
    expect(await validate(empty)).not.toHaveLength(0);
    expect(await validate(huge)).not.toHaveLength(0);
  });
});
