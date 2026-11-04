import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { pageResult, resolvePage } from '../common/pagination';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { BOSSTIARY_SLUG } from './bosstiary.constants';
import { CreateBosstiaryCommentDto } from './dto/create-bosstiary-comment.dto';
import { UpdateBosstiaryCommentDto } from './dto/update-bosstiary-comment.dto';

export const REMOVED_BOSSTIARY_COMMENT_TEXT = 'Comentário removido.';

const COMMENT_SELECT = {
  id: true,
  content: true,
  isEdited: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
  parentId: true,
  user: {
    select: {
      id: true,
      activeCharacter: { select: { name: true } },
    },
  },
} as const;

type CommentRow = {
  id: string;
  content: string;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  parentId: string | null;
  user: { id: string; activeCharacter: { name: string } | null };
};

export type PublicBosstiaryComment = {
  id: string;
  content: string;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; name: string | null };
  likesCount: number;
  likedByMe: boolean;
  replies: PublicBosstiaryComment[];
};

@Injectable()
export class BosstiaryCommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(slug: string, query: PageQueryDto, userId?: string) {
    this.requireSlug(slug);
    const { page, limit, skip } = resolvePage(query);
    const rootWhere = { slug, parentId: null };
    const [total, commentCount, roots] = await Promise.all([
      this.prisma.bosstiaryComment.count({ where: rootWhere }),
      this.prisma.bosstiaryComment.count({ where: { slug } }),
      this.prisma.bosstiaryComment.findMany({
        where: rootWhere,
        select: COMMENT_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);
    const rootIds = roots.map((comment) => comment.id);
    const replies =
      rootIds.length === 0
        ? []
        : await this.prisma.bosstiaryComment.findMany({
            where: { slug, parentId: { in: rootIds } },
            select: COMMENT_SELECT,
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          });
    const engagement = await this.engagement(
      [...rootIds, ...replies.map((comment) => comment.id)],
      userId,
    );
    const repliesByParent = new Map<string, CommentRow[]>();
    for (const reply of replies) {
      if (!reply.parentId) continue;
      const group = repliesByParent.get(reply.parentId) ?? [];
      group.push(reply);
      repliesByParent.set(reply.parentId, group);
    }
    return {
      ...pageResult(
        roots.map((comment) =>
          this.serialize(
            comment,
            engagement,
            (repliesByParent.get(comment.id) ?? []).map((reply) => this.serialize(reply, engagement)),
          ),
        ),
        total,
        page,
        limit,
      ),
      commentCount,
    };
  }

  async create(slug: string, userId: string, dto: CreateBosstiaryCommentDto) {
    this.requireSlug(slug);
    const parentId = await this.resolveParent(slug, dto.parentId);
    const created = await this.prisma.bosstiaryComment.create({
      data: { slug, userId, parentId, content: dto.content },
      select: COMMENT_SELECT,
    });
    return this.serialize(created, emptyEngagement());
  }

  async update(slug: string, commentId: string, userId: string, dto: UpdateBosstiaryCommentDto) {
    const comment = await this.requireOwnedComment(slug, commentId, userId);
    if (comment.isDeleted) {
      throw new BadRequestException('Não é possível editar um comentário removido.');
    }
    const updated = await this.prisma.bosstiaryComment.update({
      where: { id: comment.id },
      data: { content: dto.content, isEdited: true },
      select: COMMENT_SELECT,
    });
    return this.serialize(updated, await this.engagement([updated.id], userId));
  }

  async remove(slug: string, commentId: string, userId: string) {
    const comment = await this.requireOwnedComment(slug, commentId, userId);
    if (comment.isDeleted) {
      throw new BadRequestException('Comentário já removido.');
    }
    const updated = await this.prisma.bosstiaryComment.update({
      where: { id: comment.id },
      data: { isDeleted: true },
      select: COMMENT_SELECT,
    });
    return this.serialize(updated, await this.engagement([updated.id], userId));
  }

  async like(slug: string, commentId: string, userId: string) {
    const comment = await this.requireComment(slug, commentId);
    if (comment.isDeleted) {
      throw new BadRequestException('Não é possível curtir um comentário removido.');
    }
    try {
      await this.prisma.bosstiaryCommentLike.create({ data: { commentId: comment.id, userId } });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Você já curtiu este comentário.');
      }
      throw error;
    }
    return this.likeState(comment.id, userId, true);
  }

  async unlike(slug: string, commentId: string, userId: string) {
    const comment = await this.requireComment(slug, commentId);
    const removed = await this.prisma.bosstiaryCommentLike.deleteMany({
      where: { commentId: comment.id, userId },
    });
    if (removed.count !== 1) {
      throw new NotFoundException('Curtida não encontrada.');
    }
    return this.likeState(comment.id, userId, false);
  }

  private requireSlug(slug: string) {
    if (!BOSSTIARY_SLUG.test(slug) || slug.length > 80) {
      throw new BadRequestException('Invalid slug');
    }
  }

  private async requireComment(slug: string, commentId: string) {
    this.requireSlug(slug);
    const comment = await this.prisma.bosstiaryComment.findFirst({
      where: { id: commentId, slug },
      select: { id: true, slug: true, userId: true, isDeleted: true, parentId: true },
    });
    if (!comment) throw new NotFoundException('Comentário não encontrado.');
    return comment;
  }

  private async requireOwnedComment(slug: string, commentId: string, userId: string) {
    const comment = await this.requireComment(slug, commentId);
    if (comment.userId !== userId) {
      throw new ForbiddenException('Você não pode alterar este comentário.');
    }
    return comment;
  }

  private async resolveParent(slug: string, parentId?: string) {
    if (!parentId) return null;
    const parent = await this.prisma.bosstiaryComment.findFirst({
      where: { id: parentId },
      select: { id: true, slug: true, parentId: true, isDeleted: true },
    });
    if (!parent) throw new NotFoundException('Comentário não encontrado.');
    if (parent.slug !== slug) {
      throw new BadRequestException('A resposta precisa pertencer ao mesmo boss.');
    }
    if (parent.parentId) {
      throw new BadRequestException('Só é possível responder um comentário principal.');
    }
    if (parent.isDeleted) {
      throw new BadRequestException('Não é possível responder um comentário removido.');
    }
    return parent.id;
  }

  private async engagement(commentIds: string[], userId?: string) {
    if (commentIds.length === 0) return emptyEngagement();
    const likedQuery = userId
      ? this.prisma.bosstiaryCommentLike.findMany({
          where: { userId, commentId: { in: commentIds } },
          select: { commentId: true },
        })
      : Promise.resolve([]);
    const [counts, mine] = await Promise.all([
      this.prisma.bosstiaryCommentLike.groupBy({
        by: ['commentId'],
        where: { commentId: { in: commentIds } },
        _count: { _all: true },
      }),
      likedQuery,
    ]);
    return {
      counts: new Map(counts.map((row) => [row.commentId, row._count._all])),
      mine: new Set(mine.map((row) => row.commentId)),
    };
  }

  private async likeState(commentId: string, userId: string, likedByMe: boolean) {
    const engagement = await this.engagement([commentId], userId);
    return { commentId, likesCount: engagement.counts.get(commentId) ?? 0, likedByMe };
  }

  private serialize(
    comment: CommentRow,
    engagement: { counts: Map<string, number>; mine: Set<string> },
    replies: PublicBosstiaryComment[] = [],
  ): PublicBosstiaryComment {
    return {
      id: comment.id,
      content: comment.isDeleted ? REMOVED_BOSSTIARY_COMMENT_TEXT : comment.content,
      isEdited: comment.isEdited,
      isDeleted: comment.isDeleted,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      user: { id: comment.user.id, name: comment.user.activeCharacter?.name ?? null },
      likesCount: engagement.counts.get(comment.id) ?? 0,
      likedByMe: engagement.mine.has(comment.id),
      replies,
    };
  }
}

function emptyEngagement() {
  return { counts: new Map<string, number>(), mine: new Set<string>() };
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
