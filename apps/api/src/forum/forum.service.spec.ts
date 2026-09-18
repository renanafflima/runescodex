import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ForumService } from './forum.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const author = { id: 'user-1', email: 'player@runescodex.test' };

function threadRow(overrides = {}) {
  return {
    id: 'thread-1',
    title: 'Cyclops spawn',
    body: 'Where is the best cave?',
    status: 'OPEN',
    createdAt: new Date('2026-09-18T00:00:00.000Z'),
    updatedAt: new Date('2026-09-18T00:00:00.000Z'),
    author,
    replies: [
      {
        id: 'reply-1',
        body: 'Thais cave.',
        createdAt: new Date('2026-09-18T01:00:00.000Z'),
        updatedAt: new Date('2026-09-18T01:00:00.000Z'),
        author,
      },
    ],
    _count: { replies: 1 },
    ...overrides,
  };
}

describe('ForumService', () => {
  let service: ForumService;
  const prisma = {
    forumThread: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    forumReply: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [ForumService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(ForumService);
  });

  it('lists threads newest first with reply preview', async () => {
    prisma.forumThread.findMany.mockResolvedValue([threadRow()]);

    const result = await service.findAll({});

    expect(prisma.forumThread.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(result[0].status).toBe('open');
    expect(result[0].createdByUserId).toBe('user-1');
    expect(result[0].replyCount).toBe(1);
    expect(result[0].comments[0].text).toBe('Thais cave.');
  });

  it('filters threads by status', async () => {
    prisma.forumThread.findMany.mockResolvedValue([]);

    await service.findAll({ status: 'CLOSED' });

    expect(prisma.forumThread.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'CLOSED' },
      }),
    );
  });

  it('throws when thread is missing', async () => {
    prisma.forumThread.findUnique.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates a thread with the authenticated user as author', async () => {
    prisma.forumThread.create.mockResolvedValue(threadRow());

    const result = await service.create('user-1', {
      title: ' Cyclops spawn ',
      body: ' Where is the best cave? ',
    });

    expect(prisma.forumThread.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          authorId: 'user-1',
          title: 'Cyclops spawn',
          body: 'Where is the best cave?',
        },
      }),
    );
    expect(result.author.email).toBe('player@runescodex.test');
  });

  it('rejects replies on a closed thread', async () => {
    prisma.forumThread.findUnique.mockResolvedValue({
      id: 'thread-1',
      status: 'CLOSED',
    });

    await expect(
      service.createReply('user-2', 'thread-1', { body: 'Too late' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.forumReply.create).not.toHaveBeenCalled();
  });

  it('rejects close from a user who is not the author', async () => {
    prisma.forumThread.findUnique.mockResolvedValue({
      id: 'thread-1',
      authorId: 'user-1',
      status: 'OPEN',
    });

    await expect(service.close('user-2', 'thread-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.forumThread.update).not.toHaveBeenCalled();
  });
});
