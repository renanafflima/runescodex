import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { CreateForumReplyDto } from './dto/create-forum-reply.dto';
import { CreateForumThreadDto } from './dto/create-forum-thread.dto';
import { ListForumQueryDto } from './dto/list-forum-query.dto';

const AUTHOR_SELECT = {
  id: true,
  email: true,
} as const;

const REPLY_INCLUDE = {
  author: { select: AUTHOR_SELECT },
} satisfies Prisma.ForumReplyInclude;

const LIST_REPLY_TAKE = 5;

@Injectable()
export class ForumService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListForumQueryDto) {
    const where: Prisma.ForumThreadWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }

    const threads = await this.prisma.forumThread.findMany({
      where,
      include: {
        author: { select: AUTHOR_SELECT },
        replies: {
          include: REPLY_INCLUDE,
          orderBy: { createdAt: 'desc' },
          take: LIST_REPLY_TAKE,
        },
        _count: { select: { replies: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return threads.map((thread) => this.serializeThread(thread));
  }

  async findById(id: string) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id },
      include: {
        author: { select: AUTHOR_SELECT },
        replies: {
          include: REPLY_INCLUDE,
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { replies: true } },
      },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    return this.serializeThread(thread);
  }

  async create(userId: string, dto: CreateForumThreadDto) {
    const thread = await this.prisma.forumThread.create({
      data: {
        authorId: userId,
        title: dto.title.trim(),
        body: dto.body.trim(),
      },
      include: {
        author: { select: AUTHOR_SELECT },
        replies: {
          include: REPLY_INCLUDE,
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { replies: true } },
      },
    });

    return this.serializeThread(thread);
  }

  async createReply(
    userId: string,
    threadId: string,
    dto: CreateForumReplyDto,
  ) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: threadId },
      select: { id: true, status: true },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }
    if (thread.status === 'CLOSED') {
      throw new BadRequestException('Thread is closed');
    }

    await this.prisma.forumReply.create({
      data: {
        threadId,
        authorId: userId,
        body: dto.body.trim(),
      },
    });

    return this.findById(threadId);
  }

  async close(userId: string, threadId: string) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: threadId },
      select: { id: true, authorId: true, status: true },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }
    if (thread.authorId !== userId) {
      throw new ForbiddenException('Only the author can close this thread');
    }
    if (thread.status === 'CLOSED') {
      throw new BadRequestException('Thread is already closed');
    }

    await this.prisma.forumThread.update({
      where: { id: threadId },
      data: { status: 'CLOSED' },
    });

    return this.findById(threadId);
  }

  private serializeThread(thread: {
    id: string;
    title: string;
    body: string;
    status: 'OPEN' | 'CLOSED';
    createdAt: Date;
    updatedAt: Date;
    author: { id: string; email: string };
    replies: Array<{
      id: string;
      body: string;
      createdAt: Date;
      updatedAt: Date;
      author: { id: string; email: string };
    }>;
    _count: { replies: number };
  }) {
    return {
      id: thread.id,
      title: thread.title,
      body: thread.body,
      status: thread.status === 'OPEN' ? 'open' : 'closed',
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      author: thread.author,
      createdByUserId: thread.author.id,
      replyCount: thread._count.replies,
      comments: thread.replies.map((reply) => ({
        id: reply.id,
        text: reply.body,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
        author: reply.author,
        createdByUserId: reply.author.id,
      })),
    };
  }
}
